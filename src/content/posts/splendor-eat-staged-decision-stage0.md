---
title: "Splendor AIの手を段階化してみたら、補充後の追加判断は4096手中2回だった"
date: "2026-09-22"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

従来の EAT は、MAIN action と token return / noble choice をまとめた complete candidate を1回で選ぶ。実際の Splendor では途中で market refill が起こるため、refill 後の情報を見て cleanup を選べる。

そこで MAIN → refill → RETURN → NOBLE と段階化した surface を実装し、学習前の Stage 0 で使用頻度と計算コストを測った。

## 3つのaction surfaceを比較した

| arm | actionの分け方 | cleanupが見られる情報 |
| --- | --- | --- |
| C | complete candidateを最初に選ぶ | 初期公開情報のみ |
| F0 | MAIN / cleanupを分ける | refill前 |
| F1 | MAIN / cleanupを分ける | refill後 |

F0 は factorization だけを変え、F1 は post-refill information も使える。F1用に5次元の `decision_context` を追加し、parameter数は888,324から888,964になった。

## 候補は減ったが速度は変わらなかった

71 gamesから4,096 turn-start statesを集め、同じ complete leaf を実行する条件で比較した。

| metric | C | staged |
| --- | ---: | ---: |
| candidate数 | 26.0 | 24.8 |
| candidate row | baseline | -4.7% |
| state-encoder calls / turn | 1.000 | 1.0007 |
| complete turn | 1.37 ms | F0 1.38 / F1 1.37 ms |

candidate数は減ったが、batch-of-one CPU inferenceではstate encoderの固定費が支配的で、wall timeはほぼ変わらなかった。

## post-refill decisionは4096手中2回

| event | count / 4,096 turns |
| --- | ---: |
| public refill発生 | 58.7% |
| discretionary RETURN / NOBLEへ到達 | 3 |
| F1とF0で情報差が出るpost-refill cleanup | 2 |

candidate set上では reserve overflow可能なparentが2.2%、複数 noble候補が2.3%あったが、実際のtrajectoryでそのcleanupが選ばれる頻度はかなり低かった。

このStage 0では情報価値やplaying strengthは測っていない。分かったのは、候補削減による高速化は小さく、自然分布上のpost-refill recourse eventも疎だったことまでである。

そのため、いきなり大規模な3-arm trainingへ進まず、強いpolicyに近い分布でもeventが疎いかを測り、staged representation自体のlearnabilityは別のpaired trainingで検証することにした。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
