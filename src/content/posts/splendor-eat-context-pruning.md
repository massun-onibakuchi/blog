---
title: "Splendor AIのEntity-Action Transformerから重複した特徴量を外した"
date: "2026-09-14"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

Splendor をプレイする policy-value model を作っている。

前回、新しい model として EAT（Entity-Action Transformer）を導入した。

EAT は、カードや貴族、プレイヤー状態を entity として表現し、legal action も candidate として明示的に model へ渡す構造にしている。

今回は、その入力を見直して、global な context feature を16個から8個へ減らした。

単に feature 数を減らしたかったわけではない。EAT では entity 側ですでに持っている情報を、別の derived feature としてもう一度与えていたためである。

## 何を外したか

削除したのは次の8個である。

- 自分の15点までの距離
- 相手の15点までの距離
- 自分と相手の得点差
- 自分と相手の購入カード枚数差
- 現在の game ply
- 残り ply
- target prestige
- maximum plies

残した context は次の8個になる。

| feature | 意味 |
| --- | --- |
| endgame triggered | 終局ラウンドに入ったか |
| actor is starting player | 手番側が先手か |
| actor triggered endgame | 手番側が終局条件を発火したか |
| opponent triggered endgame | 相手が終局条件を発火したか |
| reserve-without-gold filter | 予約時のルール設定 |
| tier 1 deck size | tier 1 の残り枚数 |
| tier 2 deck size | tier 2 の残り枚数 |
| tier 3 deck size | tier 3 の残り枚数 |

## 得点差はすでにentityに入っている

EAT の player entity には、prestige と購入カード枚数がすでに入っている。

そのため、

```text
actor prestige - opponent prestige
```

や、

```text
15 - actor prestige
```

のような値は、model が entity から計算できる。

購入カード枚数差も同じである。

以前の flat な model では、こうした race feature を明示的に渡すことに意味があった。入力を少し加工して、学習しやすい形で与える inductive bias になるからである。

しかし EAT は player entity 同士を attention で比較できる。

そこで、元の値とその差分を両方入力するより、semantic entity を一次情報として残し、比較は network 側に任せることにした。

実際に削除した4つの derived feature は、残した player entity の prestige と購入カード枚数から再構成できることも確認している。32局面で比較すると差は float32 の丸め誤差の範囲だった。

## game plyも外した

`game_ply` と残り ply も EAT には渡さないことにした。

これは以前の model でも悩んだ feature だった。

現在が何手目かという値は、ゲームの進行度らしい情報には見える。しかし self-play policy や探索方法が変われば、同じような局面へ到達するまでの手数も変わる。

そのため absolute ply を model に直接入れると、局面そのものではなく、その局面を生成した policy の傾向を学習する shortcut になり得る。

一方で、Splendor の通常の終局処理に必要な情報は、endgame に入ったか、誰が starting player か、誰が endgame を trigger したかという形で残している。

最大 ply に到達した successor は search 側で terminal draw として処理し、network には評価させない。ply cap で終了した episode の row も学習対象から除外している。

そのため EAT の trainable input として `game_ply` や `maximum plies` を持たせる必要はないと判断した。

## 定数もnetworkへ渡さない

`target_prestige` と `maximum plies` はゲーム設定であり、局面ごとに model が推論する対象ではない。

こうした値はルールや episode execution の設定として使えばよく、毎局面の neural network input に繰り返し渡す必要はない。

EAT では、model が評価する局面そのものに必要な情報と、ゲームを動かす設定を分ける方向にした。

## contextは補助入力に戻した

EAT の中心は entity と candidate である。

```text
player / card / noble / bank entities
        |
    state attention
        |
        +--------------------+
        |                    |
policy head             value head
candidate -> state      value readout
cross-attention         + direct context
```

context feature はこの構造を補助する小さい入力であり、entity 側にある情報をもう一度まとめ直す場所にはしない。

今回の変更で context width は16から8になり、default model の trainable parameter は11,017,732から11,011,588へ少し減った。

parameter 数の削減自体が目的ではない。

重要なのは、どの情報を authoritative な入力として扱うかを整理したことである。

EAT ではカードやプレイヤーの意味を entity に持たせているので、そこから計算できる補助特徴量を増やすより、まず semantic representation 自体に仕事をさせる方針にした。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
