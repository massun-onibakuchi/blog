---
title: "Splendor AIの128回探索を再検証したら、同じ局面でも22.5%で1位の手が変わった"
date: "2026-08-22"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

Splendor をプレイする policy-value model を、PUCT というゲーム木探索と自己対局で改善している。

Splendor は宝石を集めてカードを買い、買ったカードを永久割引として使いながら得点を伸ばすゲームだ。AI は各局面で「どの手を選ぶか」という policy と、「この局面から勝てそうか」という value を予測する。

自己対局では、その予測を PUCT に入れて探索し、各合法手が何回訪問されたかという分布を次の policy の教師信号にしている。

これまで使っていたのは1手128 simulations の探索だった。policy target の平均 top-one mass は0.7024で、41.7%の局面では最大確率が0.99以上だったため、「かなりはっきりした教師信号になっている」と見ていた。

今回は、その前提を同じ局面を何度も探索し直して直接測った。

結論から言うと、分布が尖っていることは、探索結果が安定している証拠にはならなかった。

## 同じ512局面を何度も探索する

通常の自己対局では、同じ局面を独立に何度も探索しない。そのため保存された target が安定した結果なのか、たまたまその seed でそうなったのか分からない。

そこで自己対局データから512局面を取り出し、model を固定したまま別 seed で繰り返し探索する probe を追加した。

比較した条件は次の通り。

| simulations | root noise | replicas |
| ---: | --- | ---: |
| 128 | あり | 8 |
| 512 | あり | 4 |
| 128 | なし | 8 |
| 512 | なし | 4 |
| 2048 | なし | 2 |
| 4096 | なし | 2 |

合計約943万 simulations を実行した。

4096 simulations は正解ではない。すべて同じ policy-value model と同じ PUCT を使っているので、ここで測っているのは「同じ evaluator をもっと長く探索した結果に対して、低budget側がどれくらいずれるか」である。

## 128回探索は自分自身と22.5%食い違った

production と同じ128 simulations + root noise の条件を別 seed で繰り返すと、同じ設定同士でも22.5%の局面で1位の手が一致しなかった。

```text
同じ state
同じ model
同じ search config
違うのは search seed だけ

→ 22.5%で1位の手が変わる
```

さらに4096-simulation reference と比べると、128-simulation側の1位が違う局面は39.1%だった。

一方、probe 上の平均 top-one mass は0.7132で、以前の0.7024とほぼ同じだった。

つまり「target が尖っている」という現象は再現した。それでも探索結果はかなり変わった。

## noiseを外しても128 simulationsでは足りなかった

自己対局では探索を広げるため、root policy に Dirichlet noise を混ぜている。

そこで noise を外して budget だけを増やすと、4096-simulation reference と1位の手が違う割合はこうなった。

| budget | disagreement |
| ---: | ---: |
| 128 | 28.7% |
| 512 | 21.1% |
| 2048 | 12.9% |

budget を増やすほど下がっているが、2048でもまだ改善が続いている。

少なくともこの model と局面分布では、128 simulations は高budget側と同じ結論へ収束した状態ではなかった。

## root noiseの影響も大きかった

同じ128 simulationsで比べると、root noise ありの target dispersion は noise なしの9.43倍だった。

高budget reference との1位の不一致も、noise によって11.7 percentage points増えていた。

ただし「noise を消せば強くなる」という意味ではない。

root noise は普段選ばれない手も試し、自己対局で訪れる局面を広げるために使っている。target が安定しても exploration や playing strength が悪化する可能性があるので、production config はまだ変更していない。

## 単純に512 simulationsへ増やすのも危なかった

現在の自己対局では、root noise の影響で増えたと判定した visits を教師分布から差し引いている。

ただし補正後の visits が少なすぎる場合は、数sampleだけの不安定な分布を避けるため raw visits に戻す fallback がある。

この fallback は128 simulationsでは0.049%だったが、512 simulationsでは14.26%まで増えた。

しかも noiseあり512の dispersion は、128より計算量を4倍にしたにもかかわらず悪化した。

これは事前に決めた primary result ではなく exploratory な診断なので、原因まで確定したわけではない。分かったのは、現在の補正ルールが budget に対して中立ではないことまでである。

そのため「128が足りないなら、そのまま512へ増やす」という変更も行わない。

## policy targetの問題は単純なlabel noiseだけではない

同じ局面で探索結果が揺れるなら、教師ラベルの noise に見える。

現在の soft policy cross entropy は target に対して線形なので、理想的に同じ局面を何度も観測できれば seed ごとのランダムな揺れは平均される。

より問題なのは、平均した探索分布そのものが高budget側からずれていることだった。noiseなしでも128 → 512 → 2048と budget を増やすたびに4096側へ動き続けている。

実際の学習では各stateのtargetは1回しか生成しないうえ、探索結果は実際に指す手にも使われる。そのため target の揺れは次に生成される局面分布にも影響する。

## 次はnoiseと計算量を別々に試す

これまでの見方は、

```text
policy target はrichで尖っているので、たぶん十分良い
value targetの方が怪しい
```

だった。

今回、policy 側にも root noise と有限budgetという問題が実測された。

次はまず root noise の強さを変える ablation を arena 付きで行う。その後、同じ総計算量で「1局面を深く探索する」のと「局面数を増やす」のどちらが学習に効くかを比較する。

今回の4096-simulation referenceも正しい手を保証するものではなく、新しいmodelを学習したわけでも、playing strengthが改善したわけでもない。

ただ、128-simulation targetを強い教師として扱う前に測るべきだった量を、直接測れるようになった。

---

この記事は、実装・実験記録をもとに筆者とAIが共同編集しています。
