---
title: "Splendor AIのPUCTで即勝ちを厳密に扱ったら、終盤の誤探索が+0.82pt改善した"
date: "2026-09-29"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

G3の敗戦をreplayすると、相手に次の1手で勝てるreplyがあるのに、PUCTがその枝を一度も訪問せず楽観的なQを残すケースがあった。terminal ruleや必要なfeature、labelは正しく、問題はsearchが確定局面へ到達していないことだった。

そこで「1手進めれば勝敗が確定する候補」だけはnetworkに推測させず、native engineで厳密に判定する `sml-puct-v3` を作った。

## 同じmodel、同じ128 simulationsで比較した

3本のG3 lineageを固定し、point rushとreserve anchorに対してv2 / v3を比較した。修正版は2,304 gamesである。

| opponent | v3 − v2 | 95% CI |
| --- | ---: | ---: |
| point rush | +1.04 pt | [+0.36, +1.72] |
| reserve anchor | +0.61 pt | [−0.01, +1.22] |
| equal-weight primary | +0.82 pt | [+0.37, +1.28] |

結果またはdecision countが変わったのは87局、最終結果が変わったのは29局だった。24局がv3側へ改善し、5局が逆方向へ動いた。

## exact terminalだけをsearchへ渡す

v3ではnode展開時に候補をnative transitionへ通し、現在のactorがその1手で勝つ候補を検出する。

| v2 | v3 |
| --- | --- |
| low-priorな即勝ち候補は未訪問のまま残り得る | 即勝ちはpriorに関係なく認識する |
| terminal replyを読まないと親Qへ反映されない | exact +1 / -1をbackupする |
| network valueを使う | engineが答えられる場所ではengine valueを使う |

典型例では、G3が15点へ到達する購入に111/128 visitsを集めQ=0.89としていたが、その直後に相手の即勝ちがあった。v3ではそのreplyをterminal lossとして認識し、相手の勝ち札をreserveする手へ探索が移った。

## 修正範囲は限定される

ply 40以降の5,825 turnsを再検索すると、v2 / v3でselectionが変わったのは97 turnsだった。4,629 turns、79%は同一である。

| failure | v3で扱えるか |
| --- | --- |
| 次の1手の即勝ち / 即負け | 扱える |
| card-count tie-breakを含むterminal outcome | 扱える |
| 2 plies先のthreat | 扱えない |
| tier-3 + nobleなど数手先のsurge | learned value / searchに依存 |
| 終盤valueの楽観性 | 残る |

終盤の失敗をすべてtraining data不足として扱わず、engineで厳密に答えられる範囲をsearch側へ移した。残るmulti-ply threatやvalue miscalibrationは、別の学習問題として測る。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
