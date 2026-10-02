---
title: "Splendor AIのCLEANUPは学習だけではreturnを選べず、専用探索を入れた"
date: "2026-10-03T07:30:00+09:00"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

Splendorでは、カードを予約して市場が補充されたあとに、10枚を超えたトークンを返す場面がある。現在試しているstaged actionでは、カードを予約するMAINと、その後のtoken returnやnoble選択をCLEANUPとして分けている。こうすると、補充されたカードを見てから返すトークンを選べる。

以前の測定では、この「補充を見てから選ぶ」情報には小さいながら価値があった。次の課題は、そのCLEANUPをニューラルネットワークが実際に学べるかだった。

結果は厳しかった。returnの教師データを直接追加しても、学習データには適合する一方で未知のsetupへほとんど転移しなかった。さらにCLEANUPの教師例を増やすためにTAKE後のreturnまで分離したモデルでも、returnの選択はほぼuniformのままだった。

## post-refill returnを直接学習しても一般化しなかった

最初のStage 2では、同じcoarse-primary表現を使うU0とU1を比較した。U0はrefill前にcleanupを決め、U1は実際のrefillを見てからcleanupを決める。1,024件のreturnイベントを使って2,048 updatesのadaptationを行い、setupを分けた122件のreturnイベントでcross entropyを測った。

| arm / family | 初期CE | LR 1e-4後 | LR 3e-5後 | uniform CE |
| --- | ---: | ---: | ---: | ---: |
| U0 return | 1.6673 | 1.7465 | 1.6733 | 1.7112 |
| U1 return | 1.6768 | 1.6907 | 1.6759 | 1.7112 |
| U0 noble | 0.6971 | 0.6348 | 0.6229 | 0.7012 |
| U1 noble | 0.7701 | 0.6727 | 0.6743 | 0.7012 |

returnでは、最初のlearning rate 1e-4でU0とU1の両方がqualificationに失敗した。事前に許していた1回だけのamendmentとしてpeak learning rateを3e-5へ下げたが、U0は1.6673から1.6733へ悪化したままだった。U1も改善幅は0.0009程度にとどまった。

一方、nobleのcleanupは両設定で改善した。optimizer全体が動いていないわけではない。training側のreturn CEも下がっていたため、問題は「returnの教師信号を見ても何も学習しない」ことではなく、学習した選択が未知setupへ移らないことだった。

この時点で、事前に決めた停止条件に従ってStage 2を終了した。6組のconfirmation fitやfresh confirmation eventsは作っていない。したがって、refill情報を使う能力や対局強度について正負どちらの結論も出していない。

## CLEANUPの教師例を約5倍にしてもreturnはほぼuniformだった

次に、教師例の少なさが原因かを切り分けた。新しいU2では、これまでMAIN側に含めていたTAKE後のreturnもCLEANUPへ移した。1 updateあたりのCLEANUP observationはU0の約2件から約10件へ増えた。

212件のTAKE-returnイベントで、学習済みCLEANUP headのevaluator regretをuniformと比較した。regretは小さいほど良く、0ならその評価器が最良とするreturnを選べている。

| chooser | evaluator regret |
| --- | ---: |
| uniform | 0.0623 |
| U2のlearned CLEANUP head | 0.0632 |
| teacher labelのargmax | 0.0456 |
| G3 PUCT-128 | 0.0096 |

U2のlearned headはuniformより良くならなかった。事前に決めたprimary endpointでも、U2-Lと既存表現の差は+0.0004、95% intervalは[-0.0020, +0.0030]で、改善の証拠はなかった。既存のreserve-returnへも転移せず、モデル全体のleaf-law KLはU0より+0.0070悪化してguardも失敗した。

別のscreenでは、MAINとCLEANUPのscorerを共有してrepresentationを流用する案も試したが、primary contrastは-0.0002 [-0.0034, +0.0026]だった。教師量を増やすことも、scorerを共有することも、今回のreturn選択には効かなかった。

## 1-ply valueでは足りず、PUCTでは候補を分けられた

同じイベントをsearch側から見ると違う結果になった。既存Uモデル自身の1-ply valueでreturnを順位付けしてもlearned headを上回らなかった。一方、各候補の先をPUCT-128で読むと、122件のreserve-returnでlearned headに対してpre-draw +0.0281、post-refill +0.0341のevaluator-regret改善が出た。

ただし、この数字はchooserと評価側が同じG3 networkを使うshared-evaluatorの上限寄りの測定である。独立したnetworkをtruth側に置いた確認や、実運用に近いsimulation budgetの比較はまだ終わっていない。PUCT-128が対局でそのまま同じ価値を出すとは扱っていない。

ここまでの結果では、learned CLEANUP headをそのままdecision authorityにする根拠は得られなかった。一方、searchで候補を評価する経路は残ったため、次のUモデル向けにCLEANUP専用の探索配分を実装した。

## CLEANUP専用の探索配分を実装した

新しいsearch contractでは、CLEANUP rootだけに専用の探索配分を追加した。MAINのPUCTは変えていない。

| 項目 | CLEANUPでの扱い |
| --- | --- |
| policy prior | uniformに置換 |
| root noise | なし |
| 最低探索量 | 各候補へ`minimum_visits`回を強制 |
| 追加探索 | `additional_simulations`を通常のPUCTで配分 |
| 着手 | Qが最大の候補 |
| training target | `softmax((50 + N_max) * Q)` |
| arena early stop | 無効 |

learned priorを信用せず、まず全候補を最低限読む設計にした。CLEANUPは候補数が少ないため、MAINと同じprior-driven searchよりも、各候補のQを直接比較する方が今回の測定結果に合っている。

実装とcontract testは通っているが、この段階では新しいUモデル自体をまだ学習していない。CLEANUP searchを入れたplayerが強くなったという結果もまだない。

次は、独立した評価networkを使ったreturn eventの再評価と、候補ごとの8 / 32 / 128 simulationsのbudget ladderで、shared-evaluatorによる見かけの改善を切り分ける。そのうえでbudget-matched arenaへ進み、専用CLEANUP searchをself-playと対局の標準経路にするかを判断する。

---

この記事は、実装・実験記録をもとに、本文の編集を主にLLMが行い、筆者が内容を確認・修正しています。
