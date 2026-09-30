---
title: "Splendor AIでvalue lossの重みを1/4にしたrefitが+10.4pt勝った"
date: "2026-10-01T07:37:15+09:00"
isPublished: false
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を作っている。前回は同じ self-play recipe を G4 から G10 まで6世代続け、G10 が G4 を +6.15 points 上回った。一方、G8〜G10 が G5〜G7 より追加で強くなったとは確認できず、training record では policy cross-entropy が上がり、value cross-entropy が下がっていた。

今回は self-play data を新しく作らず、G5〜G10 で実際に使った corpus と開始 checkpoint を固定して fit recipe だけを変えた。512 updates のまま value loss の重みを 1.0 から 0.25 に下げた refit が、同じ checkpoint と corpus から baseline recipe で refit した network に +10.37 points 勝った。

## value lossの重みだけを変えた

EAT は action の分布を出す policy head と最終勝敗を予測する value head を同時に学習する。baseline では policy loss と value loss を同じ重みで足していたが、今回の候補では value 側の重みだけを0.25に下げた。network architecture、self-play corpus、512 updates、learning rate 1e-4 は変えていない。

対象は3本の training track、1701、2901、4301 の G5〜G10、合計18 stepである。各 step の generation-(g-1) checkpoint から、その generation が実際に使った retained rows で network を作り直したため、self-play の feedbackを混ぜずに fit recipe の差を比較できる。

---

この記事は、実装・実験記録をもとに、本文の編集を主にLLMが行い、筆者が内容を確認・修正しています。
