---
title: "Splendor AIのCPU学習ループを高速化したら、実ループで16.6%短縮できた"
date: "2026-09-29"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "performance"]
---

CPUでself-play、training、arenaを回す1 generationでは、時間の大半をONNX Runtimeの推論が使っていた。そこでsearchや学習recipeを変えず、networkへ渡すrow数とpaddingを減らす方向で最適化した。

stageごとのmicrobenchmarkでは25.2%短縮したが、実際のproduct loopを最初から最後まで測ると改善は16.6%だった。以下は後者を採用値としている。

## 何を変えたか

| 変更 | 実測 |
| --- | --- |
| logical CPUではなくphysical coreごとにworkerを置く | 16 workers 約5,400 rows/s → 8 workers 約7,600 rows/s |
| 同じpublic stateのnetwork評価をmemoize | evaluator rows: self-play -8.1%、arena -2.8% |
| candidate幅でbatchを分割 | padded/actual: self-play 1.68→1.08、arena 2.22→1.11 |
| opset 20のGELUを使う | 0.937 ms/row → 0.899 ms/row |
| 存在するentity/candidate rowだけ計算 | 約8,100 rows/s → 約11,800 rows/s |

特に効いたのはworker数を増やすことではなく、不要なrowとpaddingを減らすことだった。

## 実ループでは16.6%短縮

同じGCE c3d-standard-16 Spot VMで、self-play 256 games、training 512 updates、arena 800 pairsの1 generationをend-to-endで比較した。

| stage | baseline | treatment | change |
| --- | ---: | ---: | ---: |
| self-play | 196.0 s | 164.4 s | -16.1% |
| training | 375.7 s | 325.1 s | -13.5% |
| arena | 1,285.5 s | 1,053.7 s | -18.0% |
| generation total | 1,866.3 s | 1,555.6 s | -16.6% |

baselineではarenaがgeneration時間の約69%を占めていたため、self-playやtrainingだけを速くしてもend-to-end改善はそこで頭打ちになる。

## 速かったが採用しなかったもの

| 試したもの | 結果 | 採用しなかった理由 |
| --- | --- | --- |
| dynamic INT8 | 8,139 → 13,286 rows/s | policy top-1 agreement 94.8%、evaluator自体が変わる |
| bf16 CPU training | 1 update 約19%高速化 | training recipeが変わる |
| arena concurrency 32→128 | 約19%遅くなった | working set増加で逆効果 |

microbenchmarkだけではなく、最終的に使うworkflow全体で測り直したことで、採用できる改善を16.6%と確定できた。同じCPU時間で回せるexperiment iterationが増えることが、この変更の目的である。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
