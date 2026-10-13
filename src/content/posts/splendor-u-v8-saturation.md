---
title: "U v8自己対局ループの飽和調査：第43世代でL-s0戦74.9%に到達し、第47世代の性能低下で停止した"
date: "2026-10-13"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

直前のincumbentであるL-s0からPUCT-128のraw visitをtargetとするv8自己対局ループを継続し、成長の限界を検証した。凍結した停止規則に従い、4世代ごとに3,200対局ペアのLook判定を実施した。

L-s0の時点では飽和しておらず、第43世代まで伸び続けた。第12ブロック（第47世代）でリグレッションが検出されたためループを停止し、第43世代（D）を新たな正式モデルとして採択した。

## 対局性能の推移

ここでいう対局スコアは、勝ち1点・引き分け0.5点・負け0点の平均を百分率で表したもの。

DはL-s0に対して対局スコア74.9%（約+190 Elo）、Fに対して77.9%（L-s0比+18.2pt）を記録した。相手がPUCT-512を使う条件でも71.1%で勝ち越している。

![U v8 saturation study: strength progression by 4-generation block](/assets/images/posts/splendor-u-v8-saturation-strength.svg)

成長幅は前半の約+5pt/blockから中盤以降は約+2pt/blockへと鈍化し、第12ブロックでリグレッション（−3.55pt、上限48.1% < 50%）に達した。第47世代は共通の相手（第36世代やL-s0）に対するスコアでも第43世代を下回り、全体的な実力低下を示す結果だった。ただし、L-s0に対するスコアは72.47%で、負け越したわけではない。

## 汎化ギャップと過学習の検討

![In-sample vs held-out policy KL divergence](/assets/images/posts/splendor-u-v8-saturation-kl.svg)

In-sampleとheld-outのPolicy KLギャップは、第1世代から第47世代まで0.02〜0.04 natsで一貫していた。第47世代でもギャップは拡大しておらず、今回の診断では過学習を支持する結果は得られなかった。ただし、過学習を棄却できたわけではない。

## 事後分析での有力な仮説：Value Headの偏り

事後分析では、Value Headの正の出力バイアスが性能低下の有力な原因候補となった。

手番側の平均評価値が第44世代（+0.034）や第47世代（+0.062）でプラス側へ偏っていた。Value lossは一様なシフトに対して鈍感なため、通常の損失監視をすり抜けていた。

第47世代のWDL出力バイアスのみを補正してheld-out-43の局面での平均評価値を0に戻したところ、第43世代に対する対局スコアは46.25%から52.5%へと+6.25pt回復した（400ペア、片側p=0.005）。ただし、これは単一の事後的な検証であり、原因が確定したわけではない。

PUCT探索では未訪問ノードの初期値に親ノードの評価値を用いる（fpu_reduction = 0）。手番側の評価値がプラス側へ偏ると未訪問アクションを過大評価し、探索順位を歪める可能性がある、というのが提案された仕組みの仮説である。

## 今回のまとめ

L-s0からの自己対局は第43世代（D）でL-s0に対する対局スコア74.9%まで強化された。その後の性能低下は確認されたが、今回の診断は過学習を支持しなかった。Value Headの偏りがPUCT探索に影響したという説明は、事後分析で得られた有力な仮説として残っている。

実験条件と結果は[実験レポート](https://github.com/massun-onibakuchi/sml/blob/a6141432af337f7235a20a01b4047ce34f820227/docs/reports/2026-10-13-u-v8-saturation.md)、対局スコアの集計方法は[analyze.py](https://github.com/massun-onibakuchi/sml/blob/a6141432af337f7235a20a01b4047ce34f820227/artifacts/experiments/u-v8-saturation/2026-10-13/scripts/analyze.py)に記録されている。

---

この記事は、実装・実験記録をもとに、主にLLMが編集しています。
