---
title: "Splendor AIのEATを教師あり学習した"
date: "2026-09-19"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "training"]
---

search self-play の初期値として使うため、888,324-parameter EAT を depth-three search teacher の soft policy と terminal WDL で教師あり学習した。

## datasetとtraining

| item | value |
| --- | ---: |
| train rows | 1,048,576 |
| validation rows | 131,072 |
| test rows | 131,072 |
| epochs | 8 |
| updates | 8,192 |
| batch size | 1,024 |
| A100 fit time | 約407 s |

test は checkpoint 選択には使わず、学習終了後に1回だけ評価した。

## holdoutでもtrainと近かった

| metric | train | validation | test |
| --- | ---: | ---: | ---: |
| Policy KL | 0.1767 | 0.1790 | 0.1803 |
| Top-1 teacher agreement | 0.7243 | 0.7236 | 0.7221 |
| WDL CE | 0.5780 | 0.5932 | 0.5729 |
| WDL Brier | 0.3820 | 0.3896 | 0.3780 |

value は局面を見ない class-frequency baseline より良かった。

| test value metric | baseline | EAT |
| --- | ---: | ---: |
| WDL CE | 0.7265 | 0.5729 |
| WDL Brier | 0.5061 | 0.3780 |

calibration の最大ずれも約0.03だった。

## 序盤valueはほとんど改善していない

ゲーム進行度で分けると差が大きかった。

| decision band | WDL Brier | policy top-1 agreement |
| --- | ---: | ---: |
| ordinal 0–5 | 0.5046 | — |
| ordinal 0–11 | — | 0.495 |
| ordinal 46–73 | 0.226 | 0.875 |

序盤の WDL Brier は同じ帯域の class-frequency baseline 0.5060 とほぼ同じだった。序盤には本当に情報が少ない可能性と、modelが弱いsignalを取り切れていない可能性の両方が残る。

validation joint loss は epoch 1 の1.6410からepoch 8の1.4491まで下がり続け、最終checkpointが選ばれた。training budgetを増やす余地は残っていた。

このfitで確認したのは supervised initializer として policy / value を同時に学習できることまでで、arena strengthはまだ測っていない。次に同じcheckpointへPUCTを重ね、raw policyより良いdecisionを作れるかを見る。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
