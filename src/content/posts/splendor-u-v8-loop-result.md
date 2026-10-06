---
title: "U v8 loop result"
date: "2026-10-07T07:45:00+09:00"
isPublished: false
lang: ja
tags: ["splendor"]
---

Splendorの2人対戦を対象に、ニューラルネットワークとPUCT探索を組み合わせて自己対局学習しているUモデルを、さらに8世代学習した。

前回、MAIN局面のpolicy targetを探索のvisit countから直接作る方式へ変更した。
前回の改善を出発点に、8世代の継続学習を試した。

## 8世代後の結果

1世代あたり512組の自己対局データを生成した。
学習は各世代512 updatesで、AdamWの状態も引き継いだ。
最終世代まで評価を完了した。
主要集計の値は0.6708だった。
one-sided 95% lower boundは0.6570だった。
U8との集計値は0.6644から0.8244、original EAT G12では0.7969から0.8769へ変化した。

この1 lineageでは、target変更後の改善がその後のself-play loopでも積み上がった。
