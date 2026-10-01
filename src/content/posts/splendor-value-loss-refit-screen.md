---
title: "Splendor AIでvalue loss係数を0.25にしたrefitが+10.4pt勝った"
date: "2026-10-01T07:37:15+09:00"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を作っている。前回、G4からG10までself-playを6世代続けるとG10はG4を+6.15 points上回ったが、G8〜G10の追加改善は確認できなかった。そこで今回はG5〜G10で実際に使ったcorpusと開始checkpointを固定し、fit recipeだけを変えて18 generation stepを再学習した。

EATはactionを予測するpolicy headと勝敗を予測するvalue headを同時に学習する。baselineでは両lossを同じ係数で使う。今回は512 updatesとlearning rate 1e-4はそのままにして、value lossの係数だけを1.0から0.25へ下げた。

## value loss係数0.25が+10.37 pointsだった

同じcheckpointとcorpusからbaseline recipeでrefitしたnetworkとの直接対戦で、value loss係数0.25は+10.37 points [+8.60, +12.15]だった。3 tracksでも+12.21、+8.85、+10.06とすべて正で、G10で双方512 simulationsにしても+9.70 points、95% interval [+5.74, +13.66]だった。

一方、512 updatesを2,048へ増やしたrecipeはすべてbaselineより弱かった。value loss係数0.25で-9.16 points、LR 3e-5で-11.96、cosine LRで-17.94、baseline LRで-21.40だった。baseline LRのlong fitはtraining rowsのpolicy KLを0.057 nats改善したが、次世代のunseen rowsでは0.028 nats悪化した。

## 次はG11でtransferを確認する

value loss係数0.25は次のtransfer testの候補で、まだ通常recipeには採用していない。G10→G11でfresh collection replicates、共通opponent、replicate間の再現性を確認してから採用を判断する。

今回のrefit screenでは、updatesを増やすよりvalue lossの寄与を下げる方が大きくstrengthを動かした。

---

この記事は、実装・実験記録をもとに、本文の編集を主にLLMが行い、筆者が内容を確認・修正しています。
