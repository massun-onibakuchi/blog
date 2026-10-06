---
title: "U v8 self-play loop"
date: "2026-10-07T07:45:00+09:00"
isPublished: false
lang: ja
tags: ["splendor"]
---

Splendorの2人対戦を対象に、ニューラルネットワークとPUCT探索を組み合わせて自己対局学習しているUモデルを、さらに8世代学習した。

前回、MAIN局面のpolicy targetを変更した。探索で得られたvisit countを正規化して教師にすると、3世代後に従来方式へ68.4%で勝った。

ただし、これは3世代だけの比較だった。
変更直後の一度きりの改善なのか、その後のself-play loopでも伸び続けるのかは分からない。そこで3世代目のモデルU8-raw-3を出発点に、loopを8世代回した。

## 8世代後、出発点に67.1%で勝った

各世代では512組のseat-swapped自己対局を生成し、512 optimizer updatesを行った。探索はMAINでPUCT 128 simulationsを使い、AdamW stateも世代をまたいで引き継いだ。

最終評価ではU8-raw-3に対して67.08%だった。
1,600のseat-swapped setup pairを使った評価で、one-sided 95% lower boundは65.70%だった。

U8とoriginal EAT G12を相手にした評価でも、最終世代は出発点を上回った。
