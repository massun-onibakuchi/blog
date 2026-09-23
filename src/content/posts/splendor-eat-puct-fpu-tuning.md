---
title: "Splendor AIのPUCTを調整したら128 simulationsで+8.6pt改善した"
date: "2026-09-23"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を作っている。

前回までに、PUCT を使った search self-play を3世代回し、固定した opponent panel では generation 0 から generation 3 まで +10.9 points 改善した。

ただし、そのとき使っていた PUCT の設定自体は、以前から使っていた値をそのまま引き継いでいた。

`c_puct=1.5`、`fpu_reduction=0.25` である。

model をさらに学習する前に、まず search の設定だけでも改善余地がないか調べることにした。

結果から書くと、128 simulations では `c_puct=0.75`、`fpu_reduction=0.0` が control より +8.55 points 良かった。

95% interval は [+6.66, +10.44] points で、3つの model と3つの opponent を組み合わせた9 cellsすべてで差は正だった。

## PUCTの2つのparameterを変える

PUCT は、network が出した policy prior と search 中に得た value を使って、次に調べる手を選ぶ。

今回変えたのは `c_puct` と `fpu_reduction` である。

`c_puct` は prior を使った exploration bonus の強さを調整する。値を大きくすると、まだ十分調べていない候補を prior に従って広く見やすくなる。

`fpu_reduction` は、まだ一度も探索していない候補の初期 value をどれだけ低く置くかを決める。今回の実装では、未探索候補の value は root value から `fpu_reduction` を引いた値から始まる。

control は、

| parameter | value |
| --- | ---: |
| `c_puct` | 1.5 |
| `fpu_reduction` | 0.25 |

だった。

これに対して、

- `c_puct`: 0.75 / 1.5 / 3.0
- `fpu_reduction`: 0.0 / 0.25 / 0.5

の3×3、合計9 settingsを比較した。

## networkは固定した

search parameter の効果だけを見たかったので、今回は追加学習をしていない。

使ったのは search self-play を3世代回した後の3つの EAT、seed 1701、2901、4301 の generation 3 checkpoint である。

network の weight、feature、action representation はすべて固定した。

search も clean PUCT に固定し、128 simulations、root noiseなし、temperature 0、tree reuseなしにした。

つまり違うのは `c_puct` と `fpu_reduction` だけである。

## まず9 settingsから1つ選んだ

最初の discovery では seed 1701 の G3 model を challenger にして、残りの G3 models を opponent にした。

9 settingsで合計1,152 gamesを行った。

最も良かったのは、

| parameter | selected |
| --- | ---: |
| `c_puct` | 0.75 |
| `fpu_reduction` | 0.0 |

だった。

control に対する平均差は discovery 上では +17.2 points だった。

ただし、この数字は9 settingsの中から一番良いものを選んだ後の値なので、そのまま効果量としては使えない。

そこで、この setting だけを fresh な schedule で確認した。

## confirmationでは+8.55 pointsだった

confirmation では3つの G3 model を challenger とし、それぞれを3つの G3 opponent と対局させた。

3 challenger × 3 opponent の9 cellsで、各 cell 256 paired starts、合計9,216 gamesである。

control と finalist は同じ start と seat orientation に対応させて比較した。

結果は、

| setting | difference vs control |
| --- | ---: |
| `c_puct=0.75, fpu_reduction=0.0` | +8.55 points |
| 95% interval | [+6.66, +10.44] points |

となった。

事前に決めていた条件は、point estimate が +2 points 以上で、95% interval の下限が0より大きいことだった。

今回は両方を満たした。

3つの challenger lineage ごとの平均差は、

| lineage | difference |
| --- | ---: |
| 1701 | +8.27 points |
| 2901 | +4.85 points |
| 4301 | +12.53 points |

で、すべて正だった。

9 cellsもすべて正だったので、特定の1 modelや1 opponentだけで出た改善ではなかった。

## searchを遅くして勝っているわけではなかった

同じ128 simulationsでも parameterによって evaluator の使われ方や実行時間が変わる可能性がある。

そこで別の固定局面 corpus で timing を測った。

finalist と control の aggregate call-time ratio は 1.004 だった。

事前に決めていた ±5% の範囲に入ったため、time-matched comparisonでも両方128 simulationsのまま比較した。

secondary test では G3-2901 に対して +10.3 points、95% interval [+3.8, +16.8] pointsだった。

少なくとも今回の M2 CPU と runtime では、単純に多くの時間を使ったから強くなったという結果ではない。

## 512 simulationsでは差を確認できなかった

同じ finalist を512 simulationsでも試した。

G3-1701 の control PUCT-512 に対する差は +0.5 points、95% interval [-9.4, +10.4] pointsだった。

この test は384 gamesだけの secondary diagnostic で、interval も広い。

そのため「512では差がない」とまでは言えないが、128 simulationsで得た +8.55 points がそのまま深い search に移ることは確認できなかった。

search parameter の良し悪しは simulation budget に依存する可能性がある。

## 何が分かったか

今回分かったのは、現在の G3 EAT に対して、128 simulations の clean PUCT は inherited default のまま使うより改善できる余地がかなりあったことである。

しかも model を再学習せず、search の2つの parameter を変えただけで +8.55 points の差が出た。

一方で、`c_puct` を下げたことと `fpu_reduction` を0にしたことのどちらが主要因なのかは、この experiment だけでは分からない。3×3 grid の組み合わせとして選んでいるためである。

また、winner は `c_puct` grid の下端0.75だった。さらに低い値に改善余地がある可能性はあるが、それは別の experiment として確認する必要がある。

今回はこの setting を production default に変更していない。self-play actor の設定も変えていない。

次に重要なのは、良かった search parameter を評価時に使うだけでなく、その search から作った target を学習した次世代 model も強くなるかである。

そのため、`c_puct=0.75, fpu_reduction=0.0` を treatment にした G4 learner-transfer A/B を別に行う予定である。

search 自体が強くなることと、その search を教師にして network が強くなることは別なので、そこは分けて確認したい。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
