---
title: "Splendor AIの次の大規模学習を58,800局・16,000 stepにスケールする"
date: "2026-08-27"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "game-ai", "training"]
---

Splendor をプレイする policy-value model を作っている。

Splendor は、宝石トークンを集めてカードを買い、カードの色を以後の購入コストの割引として使いながら得点を伸ばすゲームだ。モデルは、次にどの手を選ぶかという policy と、その局面から勝つ・引き分ける・負ける確率という value を同時に予測する。

前回は、学習行数を約42万行に固定したまま、教師データを取るゲーム数を7,350局から29,400局へ増やすと、value の汎化と実戦の強さが改善した。

次は、その採用した「多くのゲームから薄く局面を取る」recipe 自体を大きくする。

ただし今回は、scale の因果効果をもう一度比較する実験ではない。目的を「scaled model を1つ作り、自己対局へ進める強さがあるか確認する」に絞った。

## データ量と学習量を一緒に2倍にする

前回採用した設定と、次に学習する設定はこうなる。

| | 前回の採用recipe | 次のscaled recipe |
| --- | ---: | ---: |
| 初期配置の組数 | 14,700 | 29,400 |
| 席順交換込みのゲーム数 | 29,400 | 58,800 |
| 学習行数 | 419,840 | 839,680 |
| optimizer steps | 8,000 | 16,000 |
| batch size | 512 | 512 |

ゲーム数、学習行数、optimizer steps を全部2倍にする一方、1ゲームから取る局面数と、学習データを何周するかはほぼ同じに保つ。

つまり今回は、

```text
同じデータを長く学習する
```

のではなく、

```text
独立したゲームを増やす
+ retained rows も増やす
+ それに合わせて optimizer budget も増やす
```

という joint scaling になる。

このため、結果が良くても「データ量だけが効いた」「step数だけが効いた」とは言えない。狙っているのは、現在のrecipeをそのまま1段大きくしたときに、実際により良いモデルを作れるかである。

## 教師データの生成は先に終わらせた

scaled experiment 用には、独立した training source を24本、さらに共通の validation と test source を生成して保存した。

1本の training source だけでも、

```text
29,988 initial groups
59,976 games
3,497,536 decisions
```

ある。

26 source 全体では Parquet payload が52個あり、約8.2 GBになった。初期配置の重複や source identity も事前に監査し、cache preparation へ進める状態まで確認している。

ただし現在の実験で実際に学習へ使うのは、そのうち `train-r00` という1本だけである。

24モデルをもう一度比較して scale effect を推定するのではなく、1つの scaled model を作って deployment 判断をする実験に狭めたためだ。

## checkpointは途中でarenaをして選ばない

学習では2,000 stepごとに checkpoint を残す。

```text
2k
4k
6k
8k
10k
12k
14k
16k
```

以前の案では、途中 checkpoint ごとに小さい対局を行い、強そうなものを探す案もあった。

しかし隣り合う checkpoint の差は小さく、小規模 arena の勝敗はかなり noisy になる。そこで現在の設計では、16,000 stepまで学習を完了してから checkpoint を比較する。

選択には、学習に使っていない共通 validation set を使う。

各 checkpoint について、

```text
policy KL
+ 0.5 × WDL cross entropy
```

を計算し、良い順に並べる。

policy KL は教師の手の分布とモデルの policy がどれくらい違うか、WDL cross entropy は勝ち・引き分け・負けの予測誤差を見る指標である。

そのうえで health check を通った checkpoint から順に、小さい self-play pilot が production path 上で正常に動くかだけ確認する。

この pilot は「どちらが強いか」を測る arena ではない。探索が壊れないか、異常終了しないか、policy target が raw noise に戻りすぎていないか、といった機械的な viability check に限定した。

## 強さを見るarenaは最後に1回だけ

checkpoint を validation だけで固定した後、初めて現在採用している incumbent model と対局する。

比較は800個の初期配置を席順交換した1,600局で行う。

探索条件は両者とも同じで、32-simulation PUCTを使う。

```text
scaled checkpoint
        vs
current incumbent

800 paired starts
= 1,600 games
```

scaled model の one-sided lower bound が0.5を明確に上回った場合だけ、次の自己対局 generation の seed にする。

通らなければ incumbent を残す。

ここで重要なのは、arena の結果を見て別の checkpoint を選び直さないことだ。

```text
train to 16k
    ↓
external validationでcheckpointを固定
    ↓
self-play viabilityを確認
    ↓
1回だけdeployment arena
```

という順序にした。

これなら「arenaを何度も見ながら一番勝った checkpoint を選ぶ」ことによる selection bias を避けられる。

## まだモデル結果はない

今回までに終わったのは、scaled training 用の教師 source の生成・監査と、学習・checkpoint選択・最終arenaの手順を固定するところまでである。

16,000 step の学習結果も、incumbentとの対局結果もまだ存在しない。

前回は「同じ42万行なら、少ないゲームから密に取るより、多くのゲームから薄く取る方が強い」という結果が出た。

次はそのrecipeを、

```text
29,400 groups
58,800 games
839,680 rows
16,000 optimizer steps
```

まで大きくした1モデルが、実際に現在のモデルを越えて自己対局へ進めるかを見る。

---

この記事は、実装・実験記録をもとに筆者とAIが共同編集しています。
