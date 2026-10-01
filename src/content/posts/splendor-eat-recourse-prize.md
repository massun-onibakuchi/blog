---
title: "Splendor AIで「補充を見てから返す」価値を測った"
date: "2026-09-26"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

カードを取ったあと市場へ新しいカードが補充され、その情報を見てからtoken returnやnoble choiceを選べる。このpost-refill情報をpolicyへ渡す価値を、representation全体を変える前にofflineで測った。

比較したのは、refill前にcleanupへcommitする場合と、refill後にcleanupを選び直せる場合である。

$$
operatorname{VOI}
=
mathbb{E}_{z}left[max_b Q(z,b)ight]
-
max_b mathbb{E}_{z}left[Q(z,b)ight]
$$

## 1 eventあたりの情報価値

Gen0〜Gen2の13,824 games、805,102 decisionsから1,319 chosen eventsを評価した。評価は別lineageのG3とclean PUCT128を使い、selectionとevaluationを分けるcross-fittingを行った。

| quantity | value |
| --- | ---: |
| post-refill recourse VOI | 0.00329 |
| one-sided 95% lower bound | 0.00288 |
| frozen threshold | 0.00250 |

thresholdを超えたので、事前ルールではper-eventの情報価値はmaterialだった。

内訳は大きく違った。

| family | n | mean VOI | one-sided 95% bound |
| --- | ---: | ---: | ---: |
| token return | 647 | 0.0054 | lower 0.0049 |
| noble choice | 672 | 0.0013 | upper 0.0020 |

価値の大半はtoken returnから来ていた。

## game全体では小さい

chosen eventは自然なtrajectoryで約0.2回/gameだった。実測occupancyを掛けるとgame-level prizeは約0.0007 score/game、約0.07 percentage point/gameになる。

| 比較 | result |
| --- | ---: |
| PUCT512 − PUCT128のVOI差 | +0.00021 [-0.00032, +0.00075] |
| cleanup correction `C+P-C` | 0.0178 score/event |
| post-refill information `C+R-C+P` | 0.00329 score/event |

search budgetを4倍にしてもVOIはほぼ変わらなかった。一方、refillを見なくてもcleanup choice自体を改善する余地は、post-refill情報価値の約5.4倍あった。

またVOIは少数のeventに偏り、上位1%の14 eventsで全体の18%を占めた。最大13 eventsを除くとlower boundは0.00247まで下がるため、tailの妥当性は別途確認が必要である。

## staged action採用の根拠にはしない

この実験で測ったのは情報を見ること自体の価値であり、staged representationの学習しやすさではない。自然occupancyでのgame-level prizeは小さく、以前のstaged armには別のlearnability costもあった。

次にaction contractを比較するときは、post-refill information prizeとrepresentationの学習コストを別々に評価する。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
