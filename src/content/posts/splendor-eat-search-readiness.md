---
title: "Splendor AIでPUCT探索を使う価値を測った"
date: "2026-09-20"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を作っている。

教師あり学習で policy と value を持たせた後は、探索付き self-play に進みたい。ただし、探索は計算量が増える。現在の network に PUCT を重ねることで、実際に raw policy より良い手を選べるのかを先に確認した。

今回使ったのは、教師あり学習を16 epochs行った EAT checkpoint である。

## PUCTで何を変えるか

EAT の policy head は、現在の局面で各合法手に score を出す。raw policy では、その中で最も高い手をそのまま選ぶ。

PUCT は、この policy を探索の prior にし、value head を leaf evaluation に使いながら複数の手順を読む。今回の比較では network 自体は同じで、違うのは「policy の1回の予測だけで指すか」「その上に探索を重ねるか」である。

探索付き self-play を始める前に知りたいのは、探索が追加コストに見合う policy improvement operator になっているかだった。

## 同じcheckpointのraw policyと対局させた

primary condition は PUCT 128 simulations とした。

同じ初期局面から2局ずつ行い、先後を入れ替えた256 pairs、512 gamesで比較した。root noise は入れず、最終的な手も temperature 0 で選んでいる。

結果は次のようになった。

| simulations | pair score | 95% interval |
| ---: | ---: | ---: |
| 32 | 0.7021 | [0.6607, 0.7436] |
| 128 | 0.8438 | [0.8116, 0.8759] |
| 512 | 0.8936 | [0.8660, 0.9211] |

128 simulations では、同じ network の greedy raw policy に対して pair score 0.8438 になった。

実験前には、95% interval の下限が0.55を超えれば bounded な search self-play を次に試す、と決めていた。結果は0.8116だったので、この条件は満たした。

少なくとも現在の EAT では、policy logits をそのまま使うより、policy と value を探索の中で組み合わせた方がかなり良い手を選べている。

## 512 simulationsまでは増やさない

探索回数を増やせば結果はさらに上がったが、増え方は同じではなかった。

32から128 simulationsへ増やした差は +0.1416 だった。一方、128から512へ4倍に増やした差は +0.0498 だった。

512 simulations の方が強いが、self-play で training data を集める場合は1手あたりの探索量を4倍にすると、同じ計算 budget で生成できる局面数が大きく減る。

現在の結果では、128 simulations が search quality と collection cost の妥当な折衷になっている。512 simulations を標準にする根拠はまだない。

## 固定した相手でも確認した

同じ checkpoint の raw policy と比較するだけでは、対戦相手も同じ network なので結果の読み方が少し難しい。

そこで別に、固定した point-rush rule policy とも対局した。

raw policy は pair score 0.5156 [0.4240, 0.6073]、PUCT 128 は 0.8281 [0.7643, 0.8919] だった。

これは絶対的な棋力測定ではなく、この特定の相手に対する比較である。それでも、探索による改善が raw policy との自己比較だけに現れたものではないことは確認できた。

## 次はsearch targetを学習できるかを見る

今回確認できたのは、現在の frozen network に PUCT を重ねると、raw policy より良い decision policy を作れるということである。

まだ、PUCT が作った policy target を学習すると network 自体が強くなることまでは確認していない。

次は128 simulationsを上限にした bounded search self-play を行い、探索で得た改善を policy-value model に戻せるかを調べる。ここから先は、探索を推論時の補助として使う段階から、探索を policy improvement の teacher として使う段階になる。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
