---
title: "Splendor AIのself-playを6世代継続したらG10がG4を+6.2pt上回った"
date: "2026-09-30T10:25:00Z"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

G4では、self-playのPUCT設定を `c_puct=0.75, fpu_reduction=0.0` に変えると1世代後のnetworkが改善した。今回はそのrecipeを変えず、G5からG10まで6世代継続した。

G10はG4との直接対戦で+6.15 pointsだった。ただし、後半3世代が前半3世代をさらに上回ったとは確認できなかった。

## frozen strength ladderで追跡した

3本のtraining trackをG4から継続し、各generationで32,768 fresh rowsを保持して512 optimizer updates進めた。評価は途中で条件を変えず、clean PUCT128のfrozen strength ladderへ毎世代当てた。arena全体は144 cells、43,776 gamesである。

事前に登録した主要な比較は次の4つだった。

| 指標 | 比較 | estimate | 95% interval |
| --- | --- | ---: | --- |
| D | G10@128 − G4@128 | +6.15 pt | [+4.78, +7.53] |
| A | G8〜G10 − G4、network rungs | +6.45 pt | [+2.70, +10.21] |
| P | G8〜G10 − G5〜G7、network rungs | +0.61 pt | [-1.79, +3.006] |
| H | G8〜G10 − G4、rule rungs | +1.84 pt | [+0.49, +3.20] |

DとAから、G10まで続けたlineageはG4より強くなった。一方Pは0をまたぎ、後半blockの追加改善は確認できなかった。

![G4からG10までのnetwork-rung composite](/assets/images/posts/splendor-g5-g10-strength.svg)

図は各generationのnetwork-rung compositeをG4との差で示したdescriptive値である。G6以降は+5〜8 points付近だが、単一generationのintervalは広いので、これだけからplateauの時点は決めていない。

## 判定はunresolvedになった

plateau判定には、Pの95% upper boundが+3 points未満であることを要求していた。実測は+3.006 pointsで、閾値を約0.006 pointだけ上回った。そのため事前ルール上の判定は `unresolved (not a plateau)` になった。

512 simulations同士のdescriptive比較でも、G7はG4に+7.5 points [+4.7, +10.4]、G10は+2.0 points [-0.9, +4.9]だった。G7とG10は別rootなので直接の強弱比較には使わないが、128 simulationsの改善を深い探索へそのまま外挿しない理由にはなる。

training recordも変化していた。

| metric | G4 | G7 | G10 |
| --- | ---: | ---: | ---: |
| visit target entropy | 0.804 | 0.901 | 0.899 |
| policy CE | 1.197 | 1.414 | 1.517 |
| value CE | 0.510 | 0.478 | 0.449 |

plain continuationはG10で止め、次はpolicy/value target、optimizer updates、data quantityを比較する。6世代のfixed recipeで得た約6 pointsのgainが、次のrecipe screenの基準になる。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
