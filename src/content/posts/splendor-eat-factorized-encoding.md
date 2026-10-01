---
title: "Splendor AIのentity encodingをfactorizeしたが、対局には効かなかった"
date: "2026-09-21"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

EAT の entity encoder では、type / role / location などの categorical metadata と cost / prestige などの数値を同じ MLP へ入れていた。これを意味ごとに factorize すると学習しやすくなるかを比較した。

## 3つのencoder

| arm | 構成 | parameters |
| --- | --- | ---: |
| B | 62 featuresをshared 2-layer MLP | 888,324 |
| F | numeric MLP + type/role/location/tier embeddings | 888,836 |
| FT | F + entity type別の最初のnumeric projection | 890,116 |

入力情報は同じで、inductive biasだけを変えている。B / F / FT を各3 seeds、同じtraining cacheと16-epoch budgetで学習した。

## offline lossは改善した

| encoder | validation joint CE |
| --- | ---: |
| B | 1.39085 |
| F | 1.38168 |
| FT | 1.37606 |

平均では FT < F < B だった。ただし baseline 自体のseed間幅は約0.0275 natsあり、平均差より大きかった。

さらに structured encoder は inference が遅かった。

| encoder | 128-sim runtime差 | matched-time budget |
| --- | ---: | ---: |
| F | +5.3% | 121 simulations |
| FT | +11.9% | 114 simulations |

## 対局では優位が消えた

| encoder | matched-time score vs B | equal-128 score vs B |
| --- | ---: | ---: |
| F | 0.4958 | 0.5049 |
| FT | 0.4661 | 0.4808 |

0.5が互角なので、validation CEの順位はplaying strengthへ移らなかった。raw policy比較でも同様だった。

今回のteacher distributionは最適policyではないため、teacher imitation lossを少し下げることと対局で良い手を選ぶことは同じではない。

このfactorizationは採用せずbaseline encoderを残した。architecture変更はoffline metricだけでなく、deployment costを含むdecision qualityまで確認する必要がある。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
