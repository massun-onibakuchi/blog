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
