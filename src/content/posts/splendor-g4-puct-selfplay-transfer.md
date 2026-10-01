---
title: "Splendor AIでPUCTの探索設定をself-playへ移したらG4が+3.26pt改善した"
date: "2026-09-29"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

G3を固定してPUCT parameterだけを変えると、128 simulationsでは `c_puct=0.75, fpu_reduction=0.0` が従来設定より+8.55 points強かった。今回は、その設定で作ったself-play dataを学習すると次世代networkも強くなるかをA/Bした。

## G3から1世代だけ比較した

3つのG3 training trackを1世代だけ継続し、各armで3 collection replicatesを作った。

| arm | c_puct | fpu_reduction |
| --- | ---: | ---: |
| control | 1.5 | 0.25 |
| treatment | 0.75 | 0.0 |

両armとも128 simulationsで、root noise、temperature、tree reuseなどは同じにした。各networkは32,768 fresh rowsを保持し、G2/G3 replayと混ぜて512 updates学習した。

評価時は両armとも `c_puct=0.75, fpu_reduction=0.0` に統一し、G3 lineages、point rush、reserve anchorへ当てた。panelは23,040 games、matched head-to-headは4,608 gamesである。

## treatmentは+3.26 points

| endpoint | treatment − control | fixed-network 95% | replicate-level 95% |
| --- | ---: | --- | --- |
| equal-halves composite | +3.26 pt | [+2.06, +4.45] | [+1.40, +5.12] |
| league half | +5.30 | [+3.59, +7.02] | [+2.16, +8.44] |
| rule half | +1.22 | [−0.17, +2.60] | [−1.57, +4.00] |
| head-to-head | +4.25 | [+2.89, +5.61] | [+2.04, +6.46] |

3 parent tracksの平均差も+4.53、+2.25、+3.00 pointsですべて正だった。改善は主にlineage network相手から来ており、point rush / reserve anchorへの改善は確認できなかった。

終盤のreserve-threat value errorも残った。

| model | threat turnsでraw valueが見積もる勝率 |
| --- | ---: |
| 実測 | 0.388 |
| G3 | 0.625 |
| control G4 mean | 0.681 |
| treatment G4 mean | 0.664 |

探索parameterの変更だけでは、このoff-distributionな終盤value errorは直らなかった。

training recordではtarget entropyがcontrol 0.723に対してtreatment 0.805、policy CEは1.023に対して1.195だった。target自体が広くなっているためCEだけでは採否を決めず、arena resultを使った。

adoption条件を満たしたので、G5以降のself-playは `sml-puct-v4, 128 simulations, c_puct=0.75, fpu_reduction=0.0` を使う。改善したsearch settingが、1世代後のnetwork strengthへtransferすることを確認できた。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
