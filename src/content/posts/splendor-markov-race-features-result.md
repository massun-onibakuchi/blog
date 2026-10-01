---
title: "Splendor AIに手番と得点レースの特徴量を入れたら対局でも強くなった"
date: "2026-09-08"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "value"]
---

value入力へ手番と得点raceの情報を追加したpaired experimentが完了した。unknown test statesのvalue predictionが改善し、PUCT32のarenaでもtreatmentが強かったため、新feature contractを採用した。

## treatmentで追加した情報

最終treatmentでは `game_ply` を外し、global featureを4個から9個へ増やした。

| feature | 目的 |
| --- | --- |
| actor is starting player | equal-turn終了時の手番差 |
| prestige difference | race状況 |
| purchased-card difference | tie-break情報 |
| actor distance to 15 | 終局までの距離 |
| opponent distance to 15 | 相手のrace状況 |

`game_ply` はrule上必要なstateではなく、game lengthへのshortcutを学ぶ可能性があるため最終実験から外した。

8組のcontrol / treatmentを同じteacher data、row identities、targets、row orderで比較し、最大16,000 optimizer stepsまで学習した。

## offline valueが改善した

| metric | result | gate |
| --- | ---: | ---: |
| WDL Brier treatment − control | -0.011508 | mean ≤ -0.0027 |
| one-sided 95% upper | -0.008802 | < 0 |
| policy KL one-sided 95% upper | +0.003634 | < +0.01 |

value改善はmateriality thresholdを超え、policy imitationの悪化も許容範囲内だった。

horizon別では終盤の改善が大きかった。

| remaining decisions | WDL Brier差 |
| --- | ---: |
| 1–8 | -0.0253 |
| 33+ | -0.0065 |

これは、starting-player情報がequal-turn終了に直接効くという仮説と整合する。

## arenaでも改善した

offline gateを通過した後、control / treatmentをPUCT32で8 replicates、合計8,192 games対戦させた。

| metric | value |
| --- | ---: |
| mean pair score | 0.523560 |
| standard error | 0.006280 |
| one-sided lower bound | 0.511662 |
| replicates ≥ 0.5 | 7 / 8 |

事前条件の「mean ≥ 0.52、lower bound > 0.5、8 replicates中6以上が0.5以上」をすべて満たした。

training data量やsearch budgetを増やさず、欠けていたstate情報を追加しただけでoffline valueとplaying strengthの両方が改善した。以後はこの9-feature contractをbaselineとして使う。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
