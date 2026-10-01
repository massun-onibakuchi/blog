---
title: "Splendor AIでvalue loss係数を0.25にしたrefitが+10.4pt勝った"
date: "2026-10-01T07:37:15+09:00"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

前回、G4からG10まで同じself-play recipeを6世代続けると、G10はG4を+6.15 points上回った。一方、G8〜G10がG5〜G7をさらに上回ったとは確認できなかった。

そこでG5〜G10で使ったcorpusと開始checkpointを固定し、fit recipeだけを変えて18 generation stepを再学習した。主に見たのは、value lossの重みとoptimizer updatesである。

## refitの結果

baselineは512 updates、learning rate 1e-4、value loss weight 1.0である。

| arm | 主な変更 | baseline比 |
| --- | --- | ---: |
| value weight 0.25 | 512 updates | +10.37 pt [+8.60, +12.15] |
| replay window拡張 | g-4..g-1 | +4.21 pt [+1.98, +6.44] |
| value weight 0.25 | 2,048 updates | -9.16 pt |
| lower LR | 2,048 updates, 3e-5 | -11.96 pt |
| cosine LR | 2,048 updates | -17.94 pt |
| baseline LR | 2,048 updates, 1e-4 | -21.40 pt |

value loss weightを0.25にした512-update armは3 tracksすべてで正方向だった。G10同士を双方512 simulationsで探索して比較しても+9.70 points、95% interval [+5.74, +13.66]だった。

一方、updatesを2,048へ増やした4 recipesはすべて弱くなった。baseline LRのlong fitはtraining rowsのpolicy KLを0.057 nats改善したが、次世代のunseen rowsでは0.028 nats悪化しており、training fitの改善がplaying strengthへ移っていない。

## 次はG11でtransferを確認する

このscreenだけでは、value loss weight 0.25を通常recipeへ採用しない。既存corpusのrefitで強かった設定がfresh self-playでも再現するかを、G10→G11のtransfer testで確認する。

今回分かったのは、試した範囲ではupdatesを増やすより、value lossの寄与を下げる方がstrengthを大きく動かしたことまでである。なぜ0.25が効くのかはまだ切り分けていない。

---

この記事は、実装・実験記録をもとに、本文の編集を主にLLMが行い、筆者が内容を確認・修正しています。
