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

## 毎世代強くなった、とは言えない

世代ごとのmonitorにはimprovedとinconclusiveが混在した。
最終世代と直前世代の比較も不確実で、1世代ずつ単調に強くなったとは主張できない。今回言えるのは、8世代という区間で最終モデルが出発点を明確に上回ったことだ。

固定した局面群でprior entropyも追跡したが、8世代で大きく増え続ける挙動は見られなかった。
出発点は1.71 natsで、最終世代は1.67 natsだった。少なくとも今回の範囲では、target変更によるrunaway softeningは観測されなかった。

古いreplay sourceは移行せず、新しいsearch contractのsourceだけで1→2→3世代分へ増やすrampを使った。
最初の1-source世代もmonitorではimprovedとなり、移行直後に崩れる挙動は見られなかった。
