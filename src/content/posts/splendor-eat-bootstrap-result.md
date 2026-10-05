---
title: "盤面と候補手を直接評価するEntity-Action Transformer（EAT）の導入"
date: "2026-09-13"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

Splendor の盤面状態を個々のオブジェクト（意味的エンティティ）として捉え、合法手を候補エンティティ（candidate）として直接評価する policy-value モデル「EAT（Entity-Action Transformer）」を導入した。現在のモデルパラメータ数は888,324個であり、共通の盤面エンコーダ（shared state encoder）から、方策を出力する policy head と勝敗確率（Win / Draw / Loss）を予測する value head へと分岐する構成をとっている。

## 盤面状態をエンティティとして表現する

モデルへの入力は、Splendor のゲーム盤面を構成する要素ごとに分割して管理される。

| entity | 主に保持する情報 |
| --- | --- |
| player | 各色トークン保有数、カード購入による恒久ボーナス、勝利点、予約カード数、先手・後手関係 |
| card | レベル（tier）、提供ボーナス色、勝利点、コスト、手元ボーナスを反映した実質コスト |
| noble | 獲得条件（貴族タイル）、プレイヤーごとの条件達成までの不足量 |
| bank | 場のトークン在庫残数 |

各エンティティを128次元のベクトルに埋め込み、3層・4ヘッドのTransformerを通じてエンティティ間の相互作用を表現する。山札のカードについては、レベルごとに学習可能なクエリを用いてプーリングし、残り枚数の情報も合わせて保持している。

## 合法手も候補エンティティとして表現する

各合法手（action candidate）には、着手の種別（effect type）と6色のトークン増減ベクトルを持たせる。対象となるカードや貴族タイルの指定は、数値を直接コピーするのではなく、盤面エンティティへの参照（ポインタ）として表現する。

```text
candidate semantics
      +
referenced card / noble
      |
 candidate query
      |
state cross-attention
      |
 policy logit
```

参照関係によって「どのアクションが盤面上のどのオブジェクトを対象としているか」を明確にし、Cross-Attention機構を通じて盤面全体の文脈に照らした着手の妥当性を評価する。なお、候補手同士の自己注意（Self-Attention）は計算コスト削減のため行わない。

## 局面評価は共通の盤面表現から算出する

局面評価（value）の算出には、1つの学習可能クエリを使用する。エンコード済みの盤面状態に対してCross-Attentionを行い、敗北・引き分け・勝利（Loss / Draw / Win）の3つのロジットを出力する。

```text
semantic entities
      |
 state transformer
      |
      +--------------------+
      |                    |
candidate-conditioned   value query
policy head             -> state attention
      |                    |
policy logits           WDL logits
```

ネットワークへの入力は盤面の一次情報（素のゲーム状態）を中心とし、容易に再計算できる集計値の冗長な入力は避けている。一方で、実質コストや貴族タイルの獲得条件達成までの不足量といった、非線形な関係性を持つ特徴量については明示的に付与している。

また、リソース関連の特徴量は最大値の `7`、勝利点は目標値の `15` で正規化するなど、各特徴量のスケールを統一する工夫も施した。

このEATアーキテクチャを強化学習の基盤とし、以後の教師ありブートストラップ、探索性能評価、自己対局ループの実験を進めている。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
