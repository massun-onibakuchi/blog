---
title: "Value Headの偏りを補正すると約3pt回復したが、学習ループへの採用は見送った"
date: "2026-10-15T08:30:00+09:00"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "value"]
---

U系モデルでは、policyだけでなく各局面の勝敗見込みを予測するvalue headも使っている。探索ではこのvalueがleaf評価として効くため、わずかな系統的な偏りでも着手選択へ積み重なる可能性がある。

最近の分析では、U v8系統の一部でvalueが楽観側へずれていることが分かった。そこで今回は、学習済みモデルそのものを再学習せず、value出力に一定のoffsetを加えて中心をずらすだけで対局強度が改善するかを調べた。

結果として、数ポイントの改善は観測できた。ただし、事前に決めた採用基準を統計的には満たさなかったため、production設定への採用は見送った。

## 何を補正したのか

対象はU v8系統の強いモデルで、policy headや探索設定はそのままにした。

変更したのはvalue headの出力だけである。モデルが出す勝敗見込みに対して固定offsetを加え、探索時のleaf valueを少し悲観側へずらした。

これはnetworkを再学習する方法ではない。既存のモデルが持つrelative orderingをできるだけ保ったまま、系統的なcalibration biasだけを補正できるかを見る最小の介入だった。

## 6,400ペアずつで比較した

補正あり・なしを、2種類の相手に対してそれぞれ6,400 seat-swapped pairsで比較した。

| opponent | offset補正の改善 |
| --- | ---: |
| g43 | +2.96pt |
| g36 | +2.55pt |

どちらの相手でも補正側がプラスだった。

方向としては一貫しており、valueの楽観biasが実際の探索品質を悪化させていた可能性とは整合する。

一方で、事前のdecision ruleでは「+2pt以上の改善を十分な確度で示す」ことを採用条件にしていた。今回の結果はpoint estimateではその水準を超えたものの、uncertainty込みでは基準を満たさなかった。

そのため、productionへは入れていない。

## なぜ数ポイント改善しても採用しなかったのか

この種の補正は実装自体は非常に安い。

それでも採用しなかった理由は、value offsetが一つのmodel lineageや特定の相手に合わせた局所的な補正になってしまう可能性があるからだ。

本当に必要なのは、

- 別世代でも同じ方向のbiasが残るか
- opponentが変わっても改善するか
- self-play中のsearch targetへ悪影響が出ないか
- calibrationを直接改善する学習側の対策より優れているか

まで確認できることになる。

今回のpoint estimateだけでproduction defaultへ入れると、次世代でbiasの向きが変わったときに逆効果になる可能性もある。

## 何が分かったか

今回の実験で重要だったのは、value headの絶対的なcalibration errorが対局強度に影響しうることを、かなり直接的に確認できた点だと思う。

policyや探索budgetを変えず、valueの中心だけを動かして2.5〜3pt程度の差が出た。

これは、今後のvalue改善では単にMSEを下げるだけでなく、

- calibration slope
- global offset
- game phaseごとのsystematic bias
- opponentやseatに依存したbias

を分けて見る価値があることを示している。

一方で、今回の補正は対症療法に近い。最終的には、学習時のtarget設計やloss、training distributionを改善し、offsetを外付けしなくてもvalue head自体が適切に較正されている状態が望ましい。

今回の結果は「今すぐoffsetを採用する」という結論ではなく、「value calibrationはplaying strengthへ効くので、次の学習設計で優先して扱う価値がある」という証拠になった。

---

この記事は、実装・実験記録をもとに、主にLLMが編集しています。
