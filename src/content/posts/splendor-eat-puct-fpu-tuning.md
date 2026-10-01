---
title: "Splendor AIのPUCTを調整したら128 simulationsで+8.6pt改善した"
date: "2026-09-23"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

search self-play を3世代回した G3 を固定し、PUCT の `c_puct` と `fpu_reduction` だけを調整した。従来値は `1.5 / 0.25` だった。

9 settings の discovery で候補を1つ選び、fresh schedule の confirmation で効果量を測った。

## 128 simulationsでは0.75 / 0.0が強かった

| stage | 条件 | 結果 |
| --- | --- | ---: |
| discovery | 3×3 grid、G3-1701 | winnerは `0.75 / 0.0` |
| confirmation | 3 models × 3 opponents、9,216 games | +8.55 pt [+6.66, +10.44] |
| timing | fixed-state corpus | call-time ratio 1.004 |
| 512-sim diagnostic | G3-1701 reference、384 games | +0.5 pt [-9.4, +10.4] |

confirmation の lineage 別差もすべて正だった。

| lineage | finalist − control |
| --- | ---: |
| 1701 | +8.27 pt |
| 2901 | +4.85 pt |
| 4301 | +12.53 pt |

9 cellsすべてで差が正だったため、特定 model / opponent だけの改善ではなかった。timing ratio も事前の ±5% 範囲内で、単に長く計算した結果ではない。

## 何を変えたか

`c_puct` は prior による exploration bonus、`fpu_reduction` は未訪問候補の初期 value を調整する。比較した grid は次の通り。

| parameter | values |
| --- | --- |
| `c_puct` | 0.75 / 1.5 / 3.0 |
| `fpu_reduction` | 0.0 / 0.25 / 0.5 |

network weight、feature、action representation、128 simulations、root noiseなし、temperature 0、tree reuseなしは固定した。

discovery の +17.2 points は9 settingsからwinnerを選んだ後の値なので、効果量としては使っていない。採用判断には fresh confirmation の +8.55 points を使った。

## 512 simulationsへの外挿はしない

512 simulations の secondary diagnostic は interval が広く、128 simulations の改善が深い search でも同じ大きさで残ることは確認できなかった。search parameter は simulation budget ごとに評価する必要がある。

また、この実験では `c_puct` と `fpu_reduction` のどちらが主要因かも分離していない。

この時点では production default や self-play actor は変更せず、次に `0.75 / 0.0` を self-play target 生成へ移し、G4 learner-transfer A/B で次世代 network まで強くなるかを確認することにした。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
