---
title: "Splendor AIでsearch self-playを3世代回したら固定panelで+10.9pt改善した"
date: "2026-09-21"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

教師あり EAT に PUCT128 を重ね、そのsearch targetを次世代networkへ学習させるloopを3世代回した。seed 1701 / 2901 / 4301 の3 tracksを独立に進め、G0とG3を同じfixed panelで比較した。

## G3はG0より+10.87 points

| metric | G0 | G3 | difference |
| --- | ---: | ---: | ---: |
| equal-weight panel score | 70.09% | 80.96% | +10.87 pt [+9.16, +12.57] |

trackごとの改善も近かった。

| track | G3 − G0 |
| --- | ---: |
| 1701 | +11.11 pt |
| 2901 | +11.10 pt |
| 4301 | +10.38 pt |

opponent別では改善幅が違った。

| opponent | G0 | G3 | difference |
| --- | ---: | ---: | ---: |
| historical EAT | 50.55% | 70.61% | +20.05 pt |
| depth-3 teacher | 80.56% | 88.15% | +7.60 pt |
| point rush | 79.17% | 84.11% | +4.95 pt |

3種類すべてで改善し、特定opponentだけへの適応ではなかった。

## 1 generationのrecipe

各世代では PUCT128 self-playから32,768 rowsを残し、512 optimizer updatesを行った。policy headはsearch target、value headはterminal WDLを学習する。

| total over 3 tracks × 3 generations | value |
| --- | ---: |
| fits | 9 |
| retained rows | 294,912 |
| optimizer updates | 4,608 |
| row presentations | 約472万 |

G0 / G3 evaluationは同じ clean PUCT128、同じstart schedules、3 tracks × 3 opponentsで対応させた。G3側4,992 gamesと同数のG0 controlを使った。

## numerical parity gateは結果を見る前に直した

generation 2でPyTorchとONNX/native evaluatorのraw logitsが数µ程度ずれ、当時のstrict parity gateに止められた。

そこでarena outcomeを見る前に、実際のconsumerが使う policy probability、WDL probability、actor-relative value、argmaxとraw-logit guardを中心にacceptance contractを固定し直した。その後の9 artifacts × CPU/CUDAを含む27 qualification runsはすべて通った。

この変更は、失敗したarena resultを見てtoleranceを緩めたものではない。

3世代のsearch self-playでplaying stackが改善したことを確認できたので、以後はこのloopを基準にsearch operator、action representation、architectureの変更を評価できるようになった。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
