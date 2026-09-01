---
title: "Splendor AIのcheckpoint評価をまとめて60%短縮した"
date: "2026-09-02"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "training"]
---

Splendor の policy-value model を作っている。

いまは value の入力に手番やゲーム進行度を追加する実験を進めている。この実験では1つの学習につき1,000 stepごとに checkpoint を残し、16,000 stepまで学習する。

つまり、1モデルにつき16個の checkpoint ができる。

最終的な model を決めるには、この16個を validation data で評価して、loss が最も小さい checkpoint を選ぶ必要がある。

この評価がかなり遅かったので、処理をまとめてみた。

## 16個のcheckpointを別々に評価していた

これまでは checkpoint ごとに通常の評価処理を呼んでいた。

```text
checkpoint 1
  loaderを作る
  modelを作る
  validationを評価

checkpoint 2
  loaderを作る
  modelを作る
  validationを評価

...

checkpoint 16
```

同じ validation data を使うのに、loader、worker pool、model、device setup などを checkpoint ごとに作り直していた。

学習そのものを変える処理ではないが、現在の実験では8組の paired replicate、つまり16モデルを学習する。1モデル16 checkpointなので、この部分だけでも繰り返し回数が多い。

## evaluatorを1つだけ作る

新しい処理では、validation loader と model を最初に1回だけ作る。

```text
loaderを作る
modelをGPUに載せる

checkpoint 1の重みをload → validation
checkpoint 2の重みをload → validation
...
checkpoint 16の重みをload → validation
```

checkpoint ごとに変えるのは model weight だけにした。

評価中は同じ validation rows、同じ loss、同じ mixed precision を使う。checkpoint の順番も変えない。

各 checkpoint の validation 全体を集計したあと、CPUへ戻す値も scalar 1個だけにしている。

この最適化で重要なのは、速くなっても checkpoint 選択の結果を変えないことだった。

## A100で測定

16 checkpoint の評価を1単位として、従来方式と新方式を A100 上で3回ずつ比較した。

実行順による影響を減らすため、control と treatment の順番を交互にしている。

| pair | 従来方式 | 新方式 | 短縮率 |
| --- | ---: | ---: | ---: |
| 1 | 591.061秒 | 232.654秒 | 60.64% |
| 2 | 589.774秒 | 234.881秒 | 60.17% |
| 3 | 593.090秒 | 234.721秒 | 60.42% |

平均では、

```text
591.3秒 → 234.1秒
```

となった。

約9分51秒かかっていた処理が約3分54秒になり、平均357.223秒、60.412%短縮できた。

事前に採用条件として10%以上の短縮を要求していたが、片側95%信頼下限でも60.021%だったため、この条件を十分に超えた。

## lossは全部同じだった

速度だけでなく、評価結果が変わっていないことも確認した。

3回の比較すべてで、16 checkpoint の validation loss は従来方式と bit 単位で一致した。

さらに、16 checkpoint から選ばれたものもすべて同じで、今回の benchmark では optimizer step 11,000 が選ばれた。

したがって、少なくともこの評価経路では、checkpoint selection の意味を変えずに実行時間だけを短縮できた。

## 学習そのものが60%速くなったわけではない

今回測ったのは、16 checkpoint の validation loss を計算する部分だけである。

training step、cache preparation、model export、実験全体の wall time が60%短縮したという意味ではない。また、model の精度や対局の強さが改善したという結果でもない。

ただ、checkpointを細かく残して選ぶ実験では、この評価を各モデルで繰り返す。現在のように複数 replicate を回す場合、数分の差がそのまま積み上がる。

そのため、現在進めている Markov race feature 実験ではこの evaluator を使うことにした。

次は、評価部分ではなく training 本体や campaign 全体でどこに時間を使っているかを切り分けたい。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
