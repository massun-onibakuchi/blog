---
title: "Splendor AIのEAT学習を3.8倍速くした"
date: "2026-09-16"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "training"]
---

EAT の supervised training では、局面ごとに合法 candidate 数が違う。平均26.8に対して最大195あり、padded batchでは小さい局面も最大幅まで計算していた。

candidateを実在するrowだけのpacked representationへ変え、512 rowsをmicrobatchへ分割せず一度に処理できるようにした。

## throughputは3.82倍

| condition | throughput |
| --- | ---: |
| before | 4,053 rows/s |
| after | 15,501 rows/s |
| speedup | 3.82× |

packed representationだけでは、従来と同じ小さいmicrobatch条件では大きく速くならなかった。padding削減でGPU memoryに余裕ができ、512 rowsを1回で処理できるようになったことが大きい。

| bottleneck | before | after |
| --- | --- | --- |
| candidate layout | batch最大幅までpadding | actual candidatesのみpacked |
| 512-row update | 128 rows × 4 microbatches | 512 rows × 1 |
| model / loss / optimizer | unchanged | unchanged |

policy score計算後だけ、candidate indexを使って `[batch, width]` へ戻す。学習するrows、loss、optimizer、model architectureは変えていない。

今回の3.82倍はpadding除去単独ではなく、padding削減で大きなmicrobatchを使えるようになった複合効果である。同じsupervised experimentを何度も回すときの反復コストを下げるexecution optimizationとして採用した。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
