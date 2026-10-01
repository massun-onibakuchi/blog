---
title: "Splendor AIでPUCT探索を使う価値を測った"
date: "2026-09-20"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

教師あり学習した同じ EAT checkpoint について、raw policyのargmaxとPUCT searchを直接対戦させた。目的は、self-playへ進む前にsearchが追加計算に見合うpolicy improvement operatorになっているかを確認することだった。

## simulation budgetを比較した

同じinitial statesを先後入れ替えで使い、root noiseなし、temperature 0で評価した。

| simulations | pair score vs raw policy | 95% interval |
| ---: | ---: | ---: |
| 32 | 0.7021 | [0.6607, 0.7436] |
| 128 | 0.8438 | [0.8116, 0.8759] |
| 512 | 0.8936 | [0.8660, 0.9211] |

128 simulationsの95% lower boundは、事前に置いた0.55のgateを大きく上回った。

32→128では+0.1416、128→512では+0.0498だった。512の方が強いが、self-playでは計算量も約4倍になるため、collection costとの折衷として128を次の標準budgetにした。

## fixed opponentでも改善した

| player | pair score vs point rush | 95% interval |
| --- | ---: | ---: |
| raw policy | 0.5156 | [0.4240, 0.6073] |
| PUCT128 | 0.8281 | [0.7643, 0.8919] |

同じnetworkとの自己比較だけでなく、固定rule policy相手でもsearchの改善が確認できた。

ここで確認したのは frozen network 上のsearch improvementまでである。次はPUCT128が作ったvisit targetを学習し、network自体へ改善を戻せるかをsearch self-playで検証する。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
