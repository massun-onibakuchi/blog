---
title: "Splendor AIのvalue特徴量からgame_plyを外すことにした"
date: "2026-09-03"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "value"]
---

Splendor をプレイする policy-value model を作っている。

前回、value の入力を見直して、手番や得点レースを表す特徴量を追加する実験を用意した。そのときは `game_ply / 160`、つまりゲーム開始から何手進んだかも入力に入れていた。

A100 で本実験をやり直す前に、この `game_ply` をもう一度考え直した。

結論としては、正規化方法を変えるのではなく、特徴量そのものを外すことにした。

## 160で割ることが問題の本体ではなかった

もともとの特徴量は次の形だった。

```text
game_ply / 160
```

160 は Splendor のルールから出てくる数字ではなく、実行を無限に長引かせないためにプロジェクト側で使っている上限である。

最初は 160 の代わりに 64 や、学習データの平均・分散を使った方がよいのではないかと考えた。

ただ、単純に `t / 160` を `t / 64` に変えても、入力直後は learned linear layer なので表現できる関数自体はほとんど変わらない。重みがスケールを吸収できるからである。

もちろん gradient の大きさや weight decay との関係は変わるので、最適化には影響し得る。

しかし、より重要なのは「何で割るか」ではなく、「絶対手数をモデルに見せる必要があるか」だった。

## ルール上必要なのは絶対手数ではない

2人用 Splendor では、誰かが15点以上になったあとも、そのラウンドで両者の手数が揃うまでプレイしてから勝敗を決める。

この終了条件で重要なのは、

- 終局ラウンドに入ったか
- 今の手番プレイヤーが先手か

という情報になる。

モデルにはすでに `endgame_triggered` があり、今回追加する `actor_is_starting` で先後も分かる。

一方、ゲーム開始から37手目なのか61手目なのかという絶対手数は、公式ルールの終了判定には必要ない。

`game_ply` はルール上欠けていた状態を復元する特徴量ではなく、ゲームの進み具合を推測するための経験的な proxy だった。

## game_plyはshortcutになり得る

絶対手数には別の問題もある。

ゲームの長さは盤面だけでなく、教師や探索設定、self-play policy の性質にも影響される。

例えば弱い policy が token を循環させやすい、reserve を多用する、探索設定によって長いゲームが増える、といったことが起こり得る。

するとモデルは盤面から勝敗を評価する代わりに、

```text
長いゲーム -> この教師ではこういう結果になりやすい
```

という相関を使える。

教師や self-play policy を更新してゲーム長の分布が変わると、その相関は壊れる可能性がある。

今のモデルには、得点、購入カード数、15点までの距離、token、reserve、market、deck の残りなど、局面そのものからゲームの進行を表せる情報がある。

そのため、絶対的な時計より盤面由来の race feature を優先することにした。

## global featureは4個から9個にする

新しい treatment では、従来の global feature 4個に次の5個だけを追加する。

| 特徴量 | 値 |
| --- | --- |
| 手番側が先手か | 0 / 1 |
| 得点差 | `(自分 - 相手) / 22` |
| 購入カード枚数差 | `(相手 - 自分) / 30` |
| 自分の15点までの距離 | `(15 - 自分の得点) / 15` |
| 相手の15点までの距離 | `(15 - 相手の得点) / 15` |

前回は `game_ply` を含めて4個から10個へ増やす予定だったが、今回は4個から9個になる。

モデル本体の attention block、state representation、policy head、WDL head は変えない。global encoder の入力幅だけを新しい feature contract に合わせる。

## 途中まで走った旧実験は使わない

以前の6特徴量版の campaign は16 unit中7 unitまで進んだところで止まっている。

sealed test や arena まで到達していないため、そこから scientific な結論は出していない。

さらに、その後に training pipeline の実行方法も変わっている。

そのため7 unitを再利用したり、新しい no-ply 条件の unit と混ぜたりせず、実験は fresh にやり直す。

新しい比較でも、

```text
8 paired replicates
29,400 groups / arm
58,800 games / arm
419,840 training rows / arm
maximum 16,000 optimizer steps
```

は維持する。

checkpoint は1,000 stepごとに16個残し、validation の joint loss で選ぶ。offline の value 改善、policy non-inferiority、horizon の安全性を確認したうえで、条件を通れば32 simulation PUCTの fresh arenaへ進む。

## まだ結果はない

今回の変更は、実験結果を見てから都合よく特徴量を消したものではない。

新しい9-wide contractでの campaign outcome はまだなく、A100 qualification や training もこれからになる。

また、`game_ply` を永久に不要だと証明したわけでもない。

長い horizon だけが悪化する、self-play へ移したときに盤面由来の特徴だけでは説明できない regression が出る、といった場合は、absolute ply の ablation を再度検討する。

今の段階では、根拠の弱い時間 proxy を先に入れるより、ルールと盤面に直接対応する情報だけで value を学習させる方を選んだ。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
