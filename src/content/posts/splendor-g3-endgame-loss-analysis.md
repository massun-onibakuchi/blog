---
title: "Splendor AIの4,608局を再生して、終盤の弱点を特定した"
date: "2026-09-27"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

G3をteacher、point rush、reserve anchorと対戦させた4,608局を、初期状態からmove-by-moveでreplayした。aggregateの勝率だけでは見えない、終盤の失敗パターンを切り分けるためである。

4,601局は元のarenaと完全に同じtrajectoryを再現した。残り7局はbatch compositionによる小さな推論差でactionが変わったが、最終結果は同じだった。

## 大半はrace loss、終盤に系統的なerrorが残った

652敗を調べると、多くは相手が先に得点raceを完成させたゲームだった。その中に、再現性のある終盤errorが混ざっていた。

| pattern | evidence |
| --- | --- |
| opponent reserve threatを過小評価 | 165 threat turnsで実勝率0.388、search 0.500、raw network 0.625 |
| card-count tie-breakを誤る | point rush + reserve anchorとのequal-prestige finishで0勝34敗 |
| multi-point surgeへのvalue更新が遅い | teacher敗戦29/268で、相手1手後にsearch valueが0.8以上低下 |
| root visitsが負け手へ集中 | error例で111〜128 visits、block候補は最大8 visits |

最後の項目はvisit concentrationの観測であり、policy prior単独が原因だとはこのreplay dataだけでは決めていない。PUCTのvisit数はpriorだけでなくQとFPUにも依存する。

reserve anchorの例では、相手がreserved cardを次の手で買えば15点へ届くのに、networkは勝率を約0.62と見積もっていた。PUCT128は0.50まで補正したが、実測0.39までは届かなかった。

tie-breakでは逆方向の学習も見えた。equal prestigeで、低カード枚数のpoint rush / reserve anchorには0勝34敗だった一方、card-heavyなteacherには21勝8敗10分だった。teacher由来のdataで「大きなengineを持ったequal-prestige state」が勝ち側に偏っていた可能性がある。

## aggregate scoreだけでは見えなかった

reserve anchorに対するG3のscoreは82.55%だった。point rushと同じstartsで比較した差は-1.56 points、95% interval [-4.59, +1.47]で、reserve-heavyな相手だけに弱いとは確認できなかった。

それでも局面単位では、reserve threat、tie-break、multi-point surgeのように改善対象を具体化できた。平均勝率が高い相手でも、特定stateではvalueやsearchが系統的に外れる。

## 次に試すこと

| 次の実験 | 見たいこと |
| --- | --- |
| endgame-threat start statesを増やす | reserve threatの0.62予測を実測0.39へ近づけられるか |
| card-count tie-breakの固定eval set | feature / labelとsearchのどちらが原因か |
| 512 simulationsでthreat turnsを再検索 | search量でblockへ反転するか |
| reserve-heavy agentを評価・self-playへ混ぜる | off-distribution errorが減るか |

replayを入れたことで、「どの相手に何%勝つか」から「どのstateを直すべきか」まで診断できるようになった。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
