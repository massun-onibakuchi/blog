---
title: "Splendor AIのEATを教師あり学習した"
date: "2026-09-19"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "training"]
---

Splendor をプレイする policy-value model として、EAT（Entity-Action Transformer）を作っている。

最終的には、この model を探索付き self-play で強くしていきたい。その前に、何も学習していない network から始めるより、既存の探索 teacher を模倣した policy と value を持たせておく方が self-play の出発点として使いやすい。

そこで現在の 888,324-parameter EAT を、まず教師あり学習した。

今回の目的は対局強度を測ることではなく、policy と value を同時に学習できる bootstrap model を作り、その fit の状態を確認することである。

## 何を学習したか

teacher は depth-three の top-k minimax search を使い、各局面で合法手の1つだけを正解として返すのではなく、複数の candidate に確率を持つ soft policy を返す。

policy head はこの分布を学習する。

value head は、その局面で手番だった player から見た最終結果を loss / draw / win の3クラスで学習する。

学習には 1,048,576 decision rows を使い、validation と test はそれぞれ 131,072 rows を固定した。test は checkpoint 選択には使わず、学習と選択が終わった後に1回だけ評価した。

学習は A100 で8 epochs、8,192 updates、1 updateあたり1,024 rowsで行った。fit 自体は約407秒だった。

## policyはteacherをどこまで再現できたか

policy の評価では cross entropy だけを見ると少し分かりにくい。

teacher 自身が複数の手に確率を分けているため、完全に再現しても cross entropy は0にならない。そこで teacher の分布との差である KL divergence も見る。

結果は次のようになった。

| metric | train | validation | test |
| --- | ---: | ---: | ---: |
| Policy KL | 0.1767 | 0.1790 | 0.1803 |
| Top-1 teacher agreement | 0.7243 | 0.7236 | 0.7221 |
| WDL CE | 0.5780 | 0.5932 | 0.5729 |
| WDL Brier | 0.3820 | 0.3896 | 0.3780 |

test では teacher が最も高い確率を付けた手と EAT の top-1 が一致した割合は 72.2% だった。

Policy KL は test で 0.1803 だった。top-1 の一致だけでなく、legal action 全体に teacher が割り当てた soft distribution との差もこの値で見ている。

## valueにも局面の情報が入った

value については、常に training data 全体の勝敗頻度を返す predictor と比較した。

test の WDL Brier score は、class-frequency baseline の 0.5061 に対して EAT は 0.3780 だった。WDL cross entropy も 0.7265 から 0.5729 まで下がった。

局面を使わず全体の class frequency だけを返す予測より、局面ごとに最終結果を予測した方が精度が高かった。

予測した value を区間ごとに分けて実際の結果と比較した calibration でも、予測値と観測値のずれは最大で約0.03だった。

## 最初の数手ではvalueがほとんど分からない

局面をゲームの進行度で分けると、value の精度は帯域ごとに大きく異なった。

最初の decision ordinal 0〜5 では、test の WDL Brier は 0.5046 だった。同じ帯域で class frequency だけを使う baseline は 0.5060 なので、ほぼ同じである。

一方、後半になるにつれて予測しやすくなり、ordinal 46〜73 の帯域では WDL Brier が 0.226 まで下がった。

policy も似た傾向があり、最初の 0〜11 の帯域では top-1 agreement が 0.495、46〜73 では 0.875 だった。

序盤は本当に勝敗情報が少ない可能性と、EAT が序盤の弱い signal をまだ十分に抽出できていない可能性がある。この1回の fit では、この2つを区別していない。

少なくとも、序盤の root value がほぼ五分に見えることだけで value head の性能を評価するのは早い。

## 8 epochsではまだvalidationが下がっていた

validation joint loss は epoch 1 の 1.6410 から、epoch 8 の 1.4491 まで下がり続けた。

そのため選ばれた checkpoint は最後の 8,192 update だった。

train、validation、test の指標も近い。例えば Policy KL は 0.1767 / 0.1790 / 0.1803 で、WDL Brier は 0.3820 / 0.3896 / 0.3780 だった。

今の範囲では、training data を増やす前に学習 budget をもう少し伸ばしたときに validation がさらに改善するかを見る価値がある。ただし、888k parameters の model capacity が先に上限になっている可能性も残るので、この fit だけでは両者を分離していない。

## 次はsearchで使う

この supervised model の用途は、teacher をそのまま置き換えることではなく、探索付き self-play の initializer にすることである。

policy は探索の prior、value は leaf evaluation として使う。

今回は supervised fit の状態だけを測っており、arena はまだ実行していない。この checkpoint の対局強度や、探索を加えたときの改善量は別に測る。

最初の fit では、policy が teacher distribution に近づき、value は class-frequency baseline より高い精度を示し、train と holdout の指標も近かった。一方で validation は最後まで改善しており、序盤 value の予測は class-frequency baseline とほぼ同じだった。

次の実験では、この checkpoint に search を重ねたときに raw policy より良い選択ができるかと、学習 budget を延ばしたときに offline 指標がどこまで改善するかを確認する。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
