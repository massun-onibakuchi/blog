---
title: "Splendor AIでsearch self-playを試したが、3世代目まで到達できなかった"
date: "2026-09-21"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を作っている。

前回、教師あり学習した EAT に PUCT を重ねると、同じ network の raw policy に対して対局成績が大きく改善することを確認した。128 simulations の PUCT は raw policy に対して pair score 0.8438 だった。

次に知りたいのは、その探索結果を教師として network に戻したとき、network 自体も強くなるかである。

そこで search self-play を3世代繰り返す実験を始めた。ただし、今回は最後まで到達できなかった。

## 探索結果を教師にして学習する

1世代の流れは単純である。

現在の model で PUCT 128 simulations の self-play を行い、探索後の policy distribution と最終的な勝敗を training target にする。そのデータで EAT を追加学習し、できた model で次の self-play を行う。

各世代では32,768 rowsを残し、512 optimizer updatesを行う。policy は search target、value は terminal WDL を学習する。2世代目以降は新しいデータだけに置き換えず、直前までの retained rows も半分 replay する。

これを3つの独立した supervised seed から開始し、それぞれ3世代まで進める計画にした。

重要なのは、途中で良さそうな checkpoint を選ばないことである。各世代の final update だけを次へ進め、3世代目の model を generation 0 と同じ固定 opponent panel で比較する。それを最初から primary endpoint にした。

## 5回の追加学習までは進んだ

実際には次のところまで進んだ。

| seed | generation 1 | generation 2 | generation 3 |
| --- | --- | --- | --- |
| 1701 | 512 updates | 1,024 cumulative updates | 未実行 |
| 2901 | 512 updates | 1,024 cumulative updates | 未実行 |
| 4301 | 512 updates | 未実行 | 未実行 |

合計では7,680 self-play gamesを生成し、163,840 rowsを retained training data として使った。完了した学習は2,560 updates、2,621,440 row presentationsである。

5つの fit はすべて training loss が下がった。例えば policy CE は generation 1 の3 seedで、最初の64 updates平均から最後の64 updates平均へそれぞれ 0.8856→0.8200、0.9383→0.8391、0.9445→0.8438 と下がっている。

ただし、training loss が下がることと対局が強くなることは別なので、これだけでは採用判断には使わない。

## export qualificationで停止した

停止したのは seed 2901 の generation 2 だった。

学習自体は update 1024 まで完了した。しかし checkpoint を ONNX/native evaluator として使う前の CPU qualification で、value scalar の一致条件を1行だけ満たさなかった。

絶対誤差は約 2.37e-6 だった。

診断すると、native scalar 変換そのものの誤差は約 2e-9 で、差の大部分は PyTorch と native backend の WDL logits の丸め差から来ていた。数値としては小さい。

それでも、ここで tolerance を広げて続行することはしなかった。qualification の条件は結果を見る前に固定していたため、失敗した checkpoint を見た後で通過条件を変えると、実験の停止条件自体が outcome-dependent になる。

そのため generation 3 は作らず、強さの primary endpoint も開かなかった。

## generation 1は少し良く見えた

停止時点で generation 1 の比較だけは完了していた。

固定した3種類の opponent に対する generation 0 との差を seed ごとに平均すると、次のようになった。

| seed | generation 1 - generation 0 |
| --- | ---: |
| 1701 | +2.08 points |
| 2901 | +7.81 points |
| 4301 | +10.94 points |

3 seed の平均は +6.94 points だった。ただし replicate 間の 95% t interval は [-4.21, +18.10] で0をまたいでいる。

初期の1世代で改善している可能性とは整合するが、3世代 self-play が継続的に model を強くするかは未確定である。もともとの判定対象は generation 3 なので、この generation 1 の数値を代わりの合格判定には使わない。

## 新しい学習をせずにqualificationだけ調べた

次に GPU training を再開するのではなく、保存してある5つの learned artifacts だけを使って inference qualification を調べた。

新しい contract では、synthetic state だけでなく実局面も含む31 probesを各 artifact に通し、PyTorch、ONNX Runtime、native evaluator の policy logits、policy probability、WDL、value scalar、argmax を分けて比較した。

結果は、seed 1701 generation 1 と seed 2901 generation 2 の2つが全条件を通過した。一方、seed 2901 generation 1、seed 4301 generation 1、seed 1701 generation 2 は real-state batch の raw policy logits に対する条件だけを満たさなかった。

一方で policy probability、WDL probability、value、argmax の条件は5 artifactすべて通っており、argmax disagreement は0だった。

ここから3 model自体の不具合を結論する根拠はない。新しい qualification は以前より広い real-state workload を使っており、実行 platform と PyTorch version も変わっている。今回の測定では、差が model の問題なのか backend arithmetic の違いなのかまでは分離していない。

新しい contract は family 全体では通らなかったので、追加 training は行わずに終了した。

## 今回分かったこと

今回の search self-play では、最も知りたかった「探索で作った target を繰り返し学習すると、EAT は3世代後に強くなるか」にはまだ答えがない。

一方で、self-play loop を評価する前提になる checkpoint の portability と inference parity を、どこまで要求するかが独立した問題として表面化した。

数値差が小さいからといって、実行後に threshold を緩めてそのまま実験を進めると、どの artifact を採用したかが観測結果に依存する。逆に必要以上に厳しい raw-logit parity を要求すると、実際の policy probability や argmax が一致していても学習実験そのものを止めることになる。

次に整理すべきなのは、PyTorch、ONNX、native evaluator の間で search/self-play に本当に必要な同値性が何かである。そこを先に固定しない限り、追加の self-play を購入しても同じ場所で判定不能になる可能性がある。

現時点では、search self-play の有効性は未確定であり、3世代の強さ比較も未解決のままにしている。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
