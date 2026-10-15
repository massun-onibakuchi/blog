---
title: "Value Headの偏りを補正すると対局強度が約3pt改善した"
date: "2026-10-15T08:30:00+09:00"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "value"]
---

U系モデルでは、policyだけでなく各局面の勝敗見込みを予測するvalue headも使っている。探索ではこのvalueがleaf評価として効くため、わずかな系統的な偏りでも着手選択へ積み重なる可能性がある。

最近の分析では、U v8系統の一部でvalueが楽観側へずれていることが分かった。そこで今回は、学習済みモデルそのものを再学習せず、value出力に一定のoffsetを加えて中心をずらすだけで対局強度が改善するかを調べた。

結果として、2種類の相手に対して一貫して2.5〜3pt程度の改善が観測された。

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

policyや探索budgetは変えていないため、この差はvalue出力の中心をずらしたことによって生じた。方向が2種類の相手で一致したことも、U v8系統に残っていた楽観biasが探索中の着手評価へ影響していた可能性と整合する。

この実験だけで、どの局面やどの探索深度で改善が生じたかまでは分からない。ただし、value headのglobalなcalibration biasだけでも、最終的なplaying strengthに数ポイント規模の差を生みうることは確認できた。

## calibration errorが探索にどう効くか

PUCTでは、leafで得たvalueが上位nodeのQへ伝播する。

そのためvalueが系統的に楽観側へずれていると、単一局面の誤差で終わらず、複数の候補を比較する探索全体へ影響する。特に候補同士の差が小さい場面では、一定方向のoffsetでもvisit配分や最終着手が変わる可能性がある。

今回の介入は、modelのrepresentationやpolicyを変えず、valueの中心だけを動かした。にもかかわらず2.55〜2.96ptの差が出たことから、現在の強度改善では「valueの順位付け」だけでなく、「valueの絶対的な較正」も独立した要因として見る必要がある。

## 何が分かったか

今回の実験で重要だったのは、value headの絶対的なcalibration errorが対局強度に影響しうることを、かなり直接的に確認できた点だと思う。

今後のvalue分析では、単にMSEを一つの値として追うだけでなく、

- calibration slope
- global offset
- game phaseごとのsystematic bias
- opponentやseatに依存したbias

を分けて測る価値がある。

また、固定offsetで改善したという結果は、学習時のvalue target、loss weighting、training distributionのどこでこのbiasが生じたのかを調べるための診断材料にもなる。

今回の実験は、value headの誤差が「予測指標上の問題」にとどまらず、searchを通してplaying strengthへ伝わることを示した。

---

この記事は、実装・実験記録をもとに、主にLLMが編集しています。
