---
title: "Splendor AIで自己対戦が見ない局面を、モデルなしで生成できるようにした"
date: "2026-09-29"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

self-playだけでdataを作ると、現在のpolicyがほとんど訪れない局面は次の世代でも不足しやすい。G3では終盤、100以上の合法候補、10-token状態などが少なかった。

そこでnetwork inferenceを使わず、rule-based policyで合法なtrajectoryを進め、指定したstate regionだけをstart stateとして保存するsamplerを作った。

## samplerの構成

| 項目 | 方法 |
| --- | --- |
| rollout | native engineのみ |
| behavior | random / teacher / point rush / reserve anchor |
| stratum | leader prestige × effective candidate count |
| sampling | 1 trajectoryから最大1 state |
| output | 既存の `sml-start-state-set-v1` |

専用のtraining pathは増やさず、既存self-playやarenaのstart sourceだけを差し替えられる。

## self-playに少ない状態を増やせた

20,000 trajectoriesから13,405 unique statesを採用した。

| metric | G3 self-play | sampled states |
| --- | ---: | ---: |
| candidates ≥ 100 | 2.2% | 14.2% |
| candidates ≥ 150 | 0.41% | 3.9% |
| candidates ≥ 200 | 0.049% | 0.69% |
| candidate p90 | 30 | 108 |
| candidate p99 | 130 | 187 |
| game ply ≥ 64 | 0.23% | 7.3% |
| endgame triggered | 1.1% | 7.8% |
| actor holds 10 tokens | 3.6% | 39% |
| actor holds any gold | 7.6% | 28% |

生成はM2 CPUで26.6秒だった。比較したG3 corpusとのexact overlapは0だった。

sampled starts 1,000件から2,000 gamesを再開すると、すべて通常の `target_score_equal_turns` で終了し、ply-cap timeoutは0だった。

| remaining plies | value |
| --- | ---: |
| p50 | 15 |
| p90 | 48 |
| max | 64 |

## behaviorごとに作れる分布が違う

reserve-heavyなbehaviorほどwide stateを作りやすい。

| behavior | emitted | candidate p90 | candidate p99 | share ≥ 100 |
| --- | ---: | ---: | ---: | ---: |
| point rush | 2,825 | 115 | 195 | 17.0% |
| reserve anchor | 3,008 | 135 | 217 | 24.7% |

sampler自体にもdistribution biasはある。目的はproduction playの自然分布を再現することではなく、通常のself-playでは不足する領域を意図的に補うことである。以後は終盤value、wide-state policy、Go-Exploit型restartなどを、自然発生を待たずに評価できる。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
