---
title: "探索ノイズを引いた教師より、そのままの訪問回数で学習した方が強かった"
date: "2026-10-06T19:00:00+09:00"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

Splendor AIのU8は、自己対局を続けても強さの伸びが鈍くなっていた。そこで今回は、探索そのものではなく、探索結果から作るpolicy targetを疑った。

自己対局では、探索を広げるためにrootへノイズを加えている。これまでの学習では、そのノイズが増やしたと推定されるvisitを差し引き、noise-correctedな分布をpolicy targetとして保存していた。考え方としては自然で、探索用のランダム性を教師信号から除けば、よりきれいな方策を学べるはずだった。

ただし、ノイズで探索された枝の中にも、本当に有望だった手が混ざる可能性がある。補正によって、その後の探索で支持を得たvisitまで弱めてしまっているなら、学習側には有用な発見が残らない。

そこで、補正済みtargetをそのまま使うcorrectedと、MAIN局面だけraw visit countをそのまま正規化してtargetにするrawを比較した。

## 比較したのはpolicy targetだけ

出発点は同じU8とし、12個のpaired seedで3世代ずつ学習した。各世代は512組の自己対局と512 optimizer updates。モデル構造、value loss、value target、探索budget、行動選択は同じで、違いはMAIN policy targetだけに限定した。

raw側でも、探索中の行動選択までraw visitへ変えたわけではない。探索時のmove selectionとroot valueには従来どおりnoise-correctedなcountを使い、学習用に保存するtargetだけをraw visit分布へ変えた。CLEANUPや探索不要で解けた局面のtargetも変更していない。

1世代目は両armで同じ自己対局データを共有した。つまり、最初の比較では「どの局面を経験したか」の違いを排除し、同じデータを異なるtargetで学習した差を見られる。

## 同じデータでもraw targetが63.6%で勝った

generation 1の時点で、rawはcorrectedに対して63.6%だった。各seed 400 pairの対局で、95%信頼区間は62.1–65.2%。

| 比較 | score | 95% CI |
| --- | ---: | ---: |
| raw G1 vs corrected G1 | 63.6% | 62.1–65.2% |

ここでは学習に使った新規自己対局データは共有されている。したがって、この差を「raw側が偶然より良い局面を自己対局で集めたから」と説明することはできない。

policy targetの作り方だけで、すでに大きな差が出た。

## 3世代後は68.4%、全12 seedでrawが勝った

その後は各arm自身のモデルで自己対局を生成し、3世代まで継続した。最終評価では、各seed 800 pairでraw G3とcorrected G3を直接対戦させた。

| 比較 | score | 95% CI |
| --- | ---: | ---: |
| raw G3 vs corrected G3 | 68.4% | 67.5–69.3% |
| raw G3 vs U8 | 70.0% | 68.0–72.0% |
| corrected G3 vs U8 | 51.9% | 50.2–53.7% |

12 seedすべてでrawが勝ち、その差は+16.6から+20.7ポイントだった。19,200局のprimary arenaでply capに達したゲームは1局だけだった。

corrected側は3世代進めてもU8に対して51.9%で、ほぼ横ばいだった。一方raw側はU8に70.0%で勝った。

今回の条件では、自己対局の成長停滞は探索budgetを増やさなくても、policy supervisionを変えるだけで大きく動いた。

## 補正でpolicyを尖らせすぎていた可能性

診断では、raw targetで学習したpolicyのprior entropyがcorrectedより2倍以上になった。

現在の探索はMAINで128 simulationsしか使わない。priorが強く尖りすぎていると、PUCTは初期priorの低い候補へ十分なvisitを配る前にbudgetを使い切る。raw targetで学習したpolicyが少し広い確率質量を残すことで、限られた探索budgetでも複数候補を調べやすくなった、という説明は今回の結果と整合する。

ただし、この実験だけで機序を特定したわけではない。raw visitにはroot noise由来の探索量も含まれるため、効いた理由が「探索中に見つけた有用な手を教師に残せたから」なのか、「より高entropyなpolicyが正則化として働いたから」なのかは切り分けられていない。

対局強度について言えるのは、raw MAIN targetという学習レシピそのものが大きく勝った、というところまでになる。

## search contractをv8へ変更した

この結果を受け、自己対局のsearch contractを `sml-puct-v8` へ更新した。

v8では、未解決のMAIN rootについて、

`policy_target = raw visit counts / total raw visits`

を保存する。一方で、実際の着手選択とroot valueの計算には、これまでどおりnoise-correctedなeffective countsを使う。

つまり、探索時の意思決定と学習教師を分離した形になる。探索ノイズをそのまま着手決定へ流し込むのではなく、探索で得られた訪問情報は学習には残す。

次のU self-play loopはraw側のG3 descendantから開始する予定で、v8 sourceだけを使う新しいreplay windowになる。旧v7 sourceとのreplay互換性を切るため、このreplay reset自体の影響は今後監視する必要がある。

今回の結果は、自己対局学習では「探索をどうするか」だけでなく、「探索のどの情報を教師として残すか」も強さを大きく左右することを示した。少なくともU8では、ノイズを除いて教師をきれいにするつもりの補正が、結果として学習に必要なpolicy massまで落としていた可能性が高い。

---

この記事は、実装・実験記録をもとに、本文の編集を主にLLMが行い、筆者が内容を確認・修正しています。
