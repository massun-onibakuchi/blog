---
title: "Splendor AIで学習行数を増やさず、対局数を4倍にしたら強くなった"
date: "2026-08-24"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "training"]
---

Splendor をプレイする policy-value model を作っている。

Splendor は、宝石トークンを集めてカードを買い、カードの色を以後の購入コストの永久割引として使いながら得点を伸ばすゲームだ。現在のモデルは、次にどの手を選ぶかという policy と、その局面から最終的に勝つ・引き分ける・負ける確率という value を同時に学習している。

これまでの実験では、value head が長く学習すると先に過学習しやすいことが分かっていた。

今回はモデルや学習 step 数を増やすのではなく、同じ学習行数を「より多くの対局から薄く取る」実験をした。

結果は明確で、対局数を4倍にした方が value の未知局面への汎化が改善し、policy を悪化させず、実際の対局でも強くなった。

## 1局の勝敗を何十局面にも使っている

value の教師信号はゲーム終了時の win / draw / loss である。

1ゲームが58手前後なら、その1つの最終結果がゲーム途中の約58局面すべてに付く。

```text
1 game
  state 1  ─┐
  state 2   │
  state 3   │
   ...      ├─ 同じ terminal WDL
  state 58 ─┘
```

局面自体は違うので58個が完全に同じデータという意味ではない。ただし教師ラベルの由来は1つのゲーム結果で、かなり強く相関している。

以前の学習では、同じデータを長く学習すると policy は大きく改善しない一方、value の validation loss が悪化した。このため「行数そのものより、独立したゲーム結果の数が足りないのではないか」という仮説を試した。

## 行数を固定して、ゲーム数だけ4倍にした

比較した2つのデータセットは、どちらも学習に使う行数を419,840行に固定した。

違うのは、それを何ゲームから取るかだけである。

| | Control | Treatment |
| --- | ---: | ---: |
| 初期配置の組数 | 3,675 | 14,700 |
| 席順交換込みのゲーム数 | 7,350 | 29,400 |
| 学習行数 | 419,840 | 419,840 |
| 1ゲームあたりの平均行数 | 57.12 | 14.28 |

Treatment はゲーム数を4倍にする代わりに、各ゲームから使う局面を約1/4に減らしている。

training に渡す行数と optimizer step 数は増やしていない。ただし教師データを作るためにプレイするゲーム数は4倍なので、source 生成コストは増える。

```text
Control
少ないゲーム × 深く読む

Treatment
多いゲーム × 薄く読む
```

モデル構造、教師、optimizer、batch size、8,000 optimizer steps などは同じにした。

さらに初期値や教師データ生成 seed を変えた12組の独立 replicate を作り、各 replicate で Control と Treatment をペアにして比較した。合計24モデルになる。

## 未知のゲームでvalueが改善した

最も重視したのは、学習にも checkpoint 選択にも使っていない4,096組の test ゲームでの WDL Brier score だった。

Brier score は、勝ち・引き分け・負けの予測確率と実際の結果のずれを見る指標で、低いほどよい。

Treatment − Control の差は

$$
D_{Brier} = -0.01553
$$

だった。

事前に成功条件を $-0.010$ 以下としていたので、それを超えて改善した。12 replicate すべてで Treatment 側の point estimate が良かった。

さらに、学習データと test データの WDL error の開きも小さくなった。

```text
Control   train → test divergence: 0.0744
Treatment train → test divergence: 0.0194
```

今回狙っていた「同じゲーム結果を何十回も学習して過適合する」方向がかなり弱くなっている。

## policyは犠牲にならなかった

ゲームを薄く sampling すると、policy 学習に必要な局面まで減ってしまう可能性がある。

ここは重要な trade-off だった。

しかし test set の policy KL は Treatment − Control で `-0.04271` だった。少なくとも policy imitation は悪化せず、point estimate ではむしろ Treatment の方が良かった。

したがって今回は、value を改善するために policy を犠牲にした、という結果ではなかった。

## 最後はモデル同士を対局させた

offline metric が改善しても、ゲームAIとして強くなるとは限らない。

そこで各 replicate の Treatment model と Control model を同じ PUCT 探索設定で対局させた。

12 replicate をまとめた pair score は

```text
Treatment vs Control
pair score = 0.5560
one-sided 95% lower bound = 0.5408
```

だった。

0.5が互角なので、Treatment 側が明確に上回った。

この実験では事前に、平均0.520以上、95% lower bound が0.5を上回ることなどを成功条件にしていた。value、policy、arena の全ゲートを通過したため、今後の supervised bootstrap では4倍のゲームから固定行数を sampling する recipe を採用する判断になった。

## 「データを増やす」より「独立したゲームを増やす」

今回面白いのは、学習行数も optimizer step も増えていないことだ。

```text
Before
419,840 rows
from 7,350 games

After
419,840 rows
from 29,400 games
```

同じ nominal なデータ量でも、value target の由来となるゲーム結果の多様性はかなり違う。

特にゲームAIでは、1 episode の最終結果を途中の全局面へ配るため、row count だけを見ると実際の教師信号の多様性を過大評価しやすい。

ただし今回の実験だけから、「独立ゲーム数を増やせば常に強くなる」と一般化はできない。

ゲーム数を増やすと1 trajectoryから取る局面密度も下がるため、この2つを完全に分離した因果実験ではない。また、同じ教師、同じモデル、同じ約42万行という条件での結果である。

それでも、少なくとも現在の Splendor AI では「1局からほぼ全部の局面を取る」より「多くの局から少しずつ取る」方が、同じ学習予算で良いモデルになった。

次にデータ量を増やすときは、単純な row 数だけでなく、何個の独立した game trajectory から来ているかも重要な軸として見ることになる。

---

この記事は、実装・実験記録をもとに筆者とAIが共同編集しています。
