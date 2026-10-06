---
title: "raw policy targetから8世代回したら、さらに+17pt伸びた"
date: "2026-10-07T08:00:00+09:00"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

前回、U8のMAIN policy targetからroot noise由来のvisitを差し引く補正をやめ、raw visit分布をそのまま学習させる実験を行った。結果は大きく、raw側の3世代目はcorrected側に68.4%で勝ち、元のU8にも70.0%で勝った。

今回は、そのraw側の強い個体を実際のproduction self-play loopの親にして、さらに8世代学習を続けた。

結論から言うと、まだ伸びた。

8世代後の最終モデルは、開始時点のU8-raw-3に対して67.08%で勝った。つまり、前回のpolicy target変更で大きく伸びたあとも、同じv8のself-play loopからさらに約17ポイント分の差がついた。

## 出発点はU8-raw-3

今回の親には、前回の12-seed policy-target実験の中からreplicate 4のU8-raw-3を使った。

このモデルはすでにU8よりかなり強い。production loopではここから毎世代、

- 512組のself-play
- 512 optimizer updates
- 最大3世代分のreplay
- sml-puct-v8
- MAIN 128 simulations
- CLEANUPは各候補128 visits
- AdamW stateの継承

という現在の標準設定で更新した。

v8では、MAINの学習targetにはraw visit分布を保存する。一方、実際の着手選択とroot value計算にはnoise-correctedなeffective countsを使う。この分離は前回の実験で大きな強度差を生んだ設定そのものになる。

## 8世代後、親に67.08%で勝った

最終評価では、generation 8のactorと開始時点のU8-raw-3を1,600組のfresh seat-swapped setupで比較した。

| 比較 | score |
| --- | ---: |
| generation 8 vs U8-raw-3 | 67.08% |
| one-sided 95% lower bound | 65.70% |

8世代後のモデルは、親に対して明確に勝った。

世代ごとのtrajectory評価でも、U8-raw-3に対する強さは継続して上昇した。途中で学習停止条件やanchor vetoは発火せず、最終判断も `continue_v8_loop` だった。

重要なのは、前回のraw target実験で一度大きく改善したあとに、その改善が一回限りで終わらなかったことだと思う。

policy targetの変更で一時的にU8の弱点を突いただけなら、その子孫同士のself-playでは差が急速に消える可能性もあった。しかし今回の8世代では、同じ学習系統の中でさらに大きな差が積み上がった。

## U8への勝率は66.4%から82.4%へ

同じsetup scheduleを使ったanchor評価では、開始時点と最終世代で次のように変化した。

| opponent | 開始時 | 8世代後 |
| --- | ---: | ---: |
| U8 | 66.4% | 82.4% |
| original EAT G12 | 79.7% | 87.7% |

U8に対しては、すでに66.4%あった勝率が82.4%まで上がった。

original EAT G12に対しても79.7%から87.7%へ上昇した。EATは以前使っていたatomic actionのモデルで、現在のU系統とはaction contractも探索系も異なるため、この比較はcompute-matchedなものではない。それでも、古い強い基準に対して世代を進めるごとに差が広がっていることは確認できた。

rule-based opponentに対しては、reserve-anchorが99.6%、denial-rushが99.2%でほぼ天井だった。ここからは強度差を測る相手としては情報量が少ない。

## priorが広がり続けて暴走することはなかった

raw policy targetを採用したときの懸念の一つは、root noiseのvisitまで教師に含めることでpolicy priorがどんどん平坦化してしまうことだった。

前回の実験では、raw側のprior entropyがcorrected側より大きくなり、それがPUCT-128で候補探索を広げる一因ではないかと考えた。

ただしentropyが世代ごとに増え続ければ、最終的にはpolicy headがほとんど候補を絞れなくなる。

今回の固定state bankでは、開始時点U8-raw-3のprior entropyが1.71 natsだった。8世代後は1.67で、全期間を通して開始時点から0.07 nats以内に収まった。

noise visit shareも51〜54%程度、fallback rateも最大0.54%で安定していた。training gameのply cap到達も0件だった。

つまり今回の8世代では、raw targetによるprior softeningが世代を重ねるたびに拡大するような挙動は見られなかった。

## v7 replayを引き継がず、v8だけで新しいwindowを作った

今回のproduction loopでは、旧sml-puct-v7のself-play sourceをv8へ変換して再利用するmigration pathは作らなかった。

generation 0ではU8-raw-3を親に、v8で新しいsourceを1世代分生成する。次の世代では2世代分、その次から3世代分という1→2→3のreplay rampを使った。

これは少しリスクがある。最初の世代だけreplay量が通常より少ないからだ。

一方で、v7とv8ではpolicy targetの意味そのものが違う。古いcorrected targetを新しいraw targetと同じreplay windowへ入れるより、v8だけで学習履歴を作り直す方を選んだ。

generation 0は、この1-source replayにもかかわらずproduction monitorで `improved` 判定になった。その後も停止条件には触れず、8世代完走した。

## raw targetは一度の実験結果ではなく、継続学習でも機能した

前回までで言えたのは、「同じU8から学習するなら、corrected targetよりraw MAIN targetの方が強い」ということだった。

今回の結果で、もう一段強いことが言えるようになった。

raw targetを使って得た強い子孫を親にして、そのままself-play feedbackを何世代も回しても改善が続いた。

最終モデルは親に67.08%で勝ち、U8への勝率も82.4%まで伸びた。少なくともこのU8-raw系統では、policy target変更は単発のrefit改善ではなく、継続self-play loopの学習レシピとして機能している。

ただし、まだ1つのlineageだけの結果である。開始モデルも前回の実験からpost hocに選んだreplicate 4で、別lineageでも同じ成長率になるとは限らない。どのmechanismが効いているのかも特定できていない。

それでも、U8付近で一度止まりかけていたself-playが、policy targetを変えた後に再び8世代伸び続けたことは、今のところかなり大きな進捗だと思う。

---

この記事は、実装・実験記録をもとに、本文の編集を主にLLMが行い、筆者が内容を確認・修正しています。
