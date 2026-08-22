---
title: "Splendor AIの128回探索を再検証したら、同じ局面でも22.5%で最善手が変わった"
date: "2026-08-22"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "reinforcement-learning", "search"]
---

Splendor をプレイする policy-value model を、PUCT というゲーム木探索と自己対局で改善している。

Splendor は宝石トークンを集めてカードを買い、買ったカードを永久割引として使いながら得点を伸ばすゲームだ。AI は各局面で「どの手を選ぶか」という policy と、「この局面から勝てそうか」という value を予測する。

自己対局では、その policy と value を PUCT に入れて探索し、各合法手が何回訪問されたかという分布を次の policy の教師信号にしている。

これまで、1手あたり128 simulations の探索で作った policy target はかなり尖っていた。平均 top-one mass は0.7024で、41.7%の局面では最大確率の手が0.99以上だった。

そのため「128回も探索していて、分布もはっきりしているなら、policy の教師信号はかなり信頼できるのでは」と考えていた。

今回は、その前提を同じ局面を何度も探索し直すことで直接測った。

結論から言うと、この前提は崩れた。

## 同じ局面を独立に何度も探索する

通常の自己対局では、ある局面を探索するのは1回だけである。

そのため、保存された policy target が

```text
本当に安定した探索結果なのか
たまたまその seed でそうなっただけなのか
```

を区別できない。

そこで今回は、自己対局データから512局面を抽出し、同じ model を固定したまま、それぞれの局面を別 seed で複数回探索する probe を追加した。

比較したのは次の6条件である。

| simulations | root noise | replicas |
| ---: | --- | ---: |
| 128 | あり | 8 |
| 512 | あり | 4 |
| 128 | なし | 8 |
| 512 | なし | 4 |
| 2048 | なし | 2 |
| 4096 | なし | 2 |

4096 simulations は「正解」ではない。

すべて同じ policy-value model と同じ PUCT を使っているので、ここで測っているのは「同じ evaluator をもっと長く探索した結果に対して、低budgetの探索がどれくらいずれるか」である。

合計では約943万 simulations を実行した。

## 128回探索は自分自身と22.5%食い違った

最も驚いたのは、production と同じ128 simulations + root noise の条件だった。

同じ局面を別 seed で探索し、複数replicaを平均して1位の手を比較すると、同じ設定同士でも22.5%の局面で top action が一致しなかった。

```text
同じ state
同じ model
同じ 128 simulations
同じ search config
違うのは search seed だけ

→ 22.5%で1位の手が変わる
```

さらに4096-simulation reference と比べると、128-simulation側の1位が違う局面は39.1%だった。

以前は target が尖っていることを「探索結果がはっきりしている」証拠として見ていた。

しかし今回、平均 top-one mass 0.7132と、以前とほぼ同じ強い集中を再現した上で、それでもかなりの局面で探索結果が変わることが分かった。

つまり、分布が尖っていることと、教師信号として安定していることは別だった。

## noiseを外しても128 simulationsでは収束していなかった

自己対局では探索を広げるため、root policy に Dirichlet noise を混ぜている。

そこで noise を完全に外した条件でも budget を増やして比較した。

4096-simulation reference と top action が違う割合は、

| budget | disagreement |
| ---: | ---: |
| 128 | 28.7% |
| 512 | 21.1% |
| 2048 | 12.9% |

だった。

budget を増やすほど改善しているが、2048まで来てもまだ明確に下がり続けている。

少なくともこの checkpoint とこの state distribution では、128 simulations は「十分読めば同じ結論になる」領域には入っていなかった。

## root noiseの影響もかなり大きかった

同じ128 simulationsで root noise の有無だけを比べると、noiseありの target dispersion は noiseなしの9.43倍だった。

また、高budget reference との disagreement も noise によって11.7 percentage points増えていた。

ただし、ここから「root noise を消せば強くなる」とは言えない。

root noise は自己対局で普段選ばれない手も試し、state distribution を広げるために入れている。noise を弱くすると policy target は安定しても、探索の多様性や最終的な playing strength が落ちる可能性がある。

そのため production config はまだ変更していない。

## 単純に512 simulationsへ増やすのも危なかった

もう一つ、事前には想定していなかった現象が見つかった。

現在の自己対局では、root noise の影響で増えたと判定した visits を policy target から差し引く補正を行っている。

ただし補正後の visits が少なすぎる場合は、教師分布が数sampleだけになるのを避けるため raw visits へ戻す fallback がある。

128 simulationsでは、この fallback は0.049%しか起きなかった。

ところが512 simulationsでは14.26%まで増えた。

しかも noiseあり512の target dispersion は、128より計算量を4倍にしたにもかかわらず悪化した。

この診断は事前に決めた primary result ではなく exploratory であり、なぜ noise-attributed visits が増えるのかまで因果的に説明できたわけではない。

分かったのは、現在の補正ルールは budget を変えても同じ性質を保つわけではない、ということまでである。

したがって「128が足りないなら、とりあえず512へ増やす」という変更はしないことにした。

## label noiseだけを見ると話は少し複雑

同じ局面で探索結果が揺れるなら、単純には教師ラベルの noise に見える。

ただし現在使っている soft policy cross entropy は target に対して線形なので、理想的に無限回同じ局面を観測できれば、seedごとのランダムな揺れ自体は平均される。

より重要なのは、平均した探索分布そのものが高budget側から系統的にずれていることになる。

今回の実験では、単なるreplica間のばらつきだけでなく、128 → 512 → 2048 と budget を増やすたびに平均targetが4096側へ動き続けた。

一方、実際の学習では各stateのtargetは1回しか生成しない。さらに探索結果は次に実際に選ぶ手にも使われるため、targetの揺れは次世代のstate distributionにも影響する。

そのため fixed-state 上の単純なlabel noiseだけとして片付けることもできない。

## 次はnoiseと計算量を別々に切り分ける

今回の結果から、これまでの

```text
policy target はrichで尖っているので、たぶん十分良い
value targetの方が怪しい
```

という見方は修正する必要が出てきた。

policy targetにも、root noiseと有限budgetという別の問題が実測された。

次に行う順番は、まず root noise の強さを変える ablation を arena 付きで行う。その後、同じ総計算量で「1局面を深く探索する」のと「局面数を増やす」のどちらが学習に効くかを比較する。

今回の4096-simulation referenceも正しい手を保証するものではないし、まだ新しいmodelを学習したわけでも、playing strengthが改善したわけでもない。

ただ、128-simulation targetを強い教師として扱う前に測るべきだった量を、ようやく直接測れるようになった。

---

この記事は、実装・実験記録をもとに筆者とAIが共同編集しています。
