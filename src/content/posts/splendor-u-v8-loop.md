---
title: "Uのself-playを8世代続けた結果"
date: "2026-10-07T07:45:00+09:00"
isPublished: false
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

Splendorの2人対戦を対象に、ニューラルネットワークとPUCT探索を組み合わせて自己対局学習しているUモデルを、さらに8世代学習した。

前回はMAIN局面のpolicy targetを探索のvisit countから直接作る方式へ変更し、3世代の比較で改善が確認できた。今回は、その3世代目を出発点に、実際のself-play loopでも改善が続くかを確かめた。

8世代後の主要集計は0.6708、one-sided 95 percent lower boundは0.6570だった。U8との集計値は0.6644から0.8244、original EAT G12では0.7969から0.8769へ変化した。

固定したstate bankではprior entropyが1.71 natsから最終的に1.67 natsとなり、今回の範囲ではrunaway softeningは観測されなかった。

結果は1 lineageのものなので、別lineageでの再現と、search budgetとpolicy entropyの関係はまだ確認が必要になる。
