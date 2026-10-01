---
title: "Splendor AIの25本の実験を横断して、研究計画を組み直した"
date: "2026-09-29T09:58:19Z"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

個別のsearch rule、action representation、学習量、data generationを調べる実験が25本まで増えた。そこで各reportの「次にやること」ではなく、実測結果だけを並べ直して研究順序を決め直した。

## 25本を横断して残った証拠

| 観測 | 実測 | 次の判断 |
| --- | --- | --- |
| self-play loop | G0→G3で+10.87 pt [+9.16, +12.57] | loop自体は学習できている |
| PUCT設定のtransfer | G4 treatmentがcontrolに+3.26 pt [+2.06, +4.45] | self-play recipeはstrengthを動かす |
| rule opponent | G4がpoint rush / reserve anchorに約88〜90% | 1〜2 ptの改善測定には飽和気味 |
| decisive search | v3 − v2 = +0.82 pt [+0.37, +1.28] | 明確なsearch defectは直す価値がある |
| 追加exactness | v4 − v3 = +0.09 pt [-0.15, +0.32] | search ruleの細分化は優先度を下げる |
| post-refill recourse | 0.00329 score/event、自然occupancyでは約0.07 pt/game | no-blind strengthの主経路には置かない |
| target diagnostic | corrected visits regret 0.0359、raw 0.0167、Gumbel 0.0059 | target constructionを直接A/Bする |
| G4 campaign cost | collection 2.34 h、fit 0.26 hに対しarena 4.87 h | evaluation costも研究budgetとして扱う |

この表を見ると、model capacityやsearch heuristicより先に、学習recipeと評価instrumentを固める必要があった。

## 研究順序を変えた

今後の順番は次の通りにした。

| 順位 | 実験 | 目的 |
| ---: | --- | --- |
| 1 | frozen strength ladder | 世代間の強さを同じ物差しで測る |
| 2 | multi-generation continuation | 同じrecipeでlearning curveを得る |
| 3 | policy / value target screen | learnerへ何を教えるかを比較する |
| 4 | update budget、data quantity | 1世代の学習量を決める |
| 5 | collection breadth vs search depth | 同じcomputeの使い道を比較する |
| 6 | start-state diversity | rare stateや終盤threatを補う |
| 7 | blind reserve対応 | 最終的なBGA contractへ近づける |

一方、128 simulations周辺の細かいPUCT grid、追加のendgame heuristic、CPUのmicro-optimizationは優先度を下げた。staged actionはblind reserveの基盤として続けるが、現在のno-blind playing strengthを伸ばす主経路には置かない。

## 個別修正からlearning systemへ

これまでの実験で、searchを直せば強くなるケースと、直してもほとんど変わらないケースを分けられるようになった。次に不足しているのは「同じ条件で伸び続けるか」「どのtargetが良いか」「1世代にどれだけ学習させるか」というlearning systemの中心部分である。

以後の実験は、局所的な指標だけでなくfrozen ladder上のdownstream playing strengthで採否を決める。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
