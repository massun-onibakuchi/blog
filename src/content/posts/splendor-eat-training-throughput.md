---
title: "Splendor AIのEAT学習を3.8倍速くした"
date: "2026-09-16"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "training"]
---

Splendor をプレイする policy-value model を作っている。

現在使っている EAT（Entity-Action Transformer）は、局面に存在するカードやプレイヤーを entity、合法手を candidate として扱う model である。

今回は model の構造や学習目標を変えず、教師あり学習の1 updateにかかる時間を見直した。

A100 上では、同じ512 rowsの update が 4,053 rows/s から 15,501 rows/s になった。約3.82倍で、同じ36,000 updatesを行う場合の training wall time は約74%減る。

精度や playing strength が上がったという話ではない。同じ学習を、余計な計算と GPU dispatch を減らして速くした。

## legal actionの数は局面ごとに違う

EAT の policy は、局面ごとの legal action を candidate として入力する。

Splendor では candidate 数が一定ではない。今回使った60,082 decision rowsでは、candidate 数は平均26.8、中央値24、p95が46、最大195だった。

普通に batch を作ると、candidate tensor は batch 内で一番多い局面の幅に合わせて padding することになる。

例えば candidate が20個しかない局面でも、同じ batch に100個の局面があれば100個分の領域を持つ。存在しない80個は mask されるが、途中の neural network 計算ではその padding がコストになる。

128 rows の microbatch では、実際に存在する candidate に対して padded grid が平均で約4.8倍になっていた。

## GPUは計算量よりdispatchで詰まっていた

最初は GPU の演算そのものが重いと考えやすいが、A100 の profile は違っていた。

従来は effective batch 512 rows の1 updateを、128 rowsずつ4 microbatchesに分けて gradient accumulation していた。

EAT では1 microbatchあたり約1,750 kernel launchesが発生しており、小さい kernel を大量に起動する overhead が支配的になっていた。GPU の演算能力を使い切る前に、host 側から何度も処理を dispatch する時間が効いていた。

実際、padding をそのままにして microbatch を128から512へ大きくするだけでも、EAT は 4,053 rows/s から15,208 rows/sまで上がった。

つまり最初の大きな bottleneck は、candidate の演算量そのものより microbatch を細かく分けすぎていたことだった。

## candidateをpackedにした

とはいえ microbatch を大きくすると、padding に使う GPU memory も増える。

そこで training path では candidate を padded tensor のまま保持せず、存在する candidate row だけを連続して並べる packed layout にした。

概念的には、

```text
padded
row 0: A B C - -
row 1: D E F G H
row 2: I J - - -

packed
A B C D E F G H I J
```

という形になる。

batch 側で `candidate_pad_index` を作っておき、policy score を計算した後だけ元の `[batch, width]` の位置へ戻す。

training と inference で別の policy 計算を持つのではなく、candidate scoring 自体は同じ実装を使う。ONNX/native inference は従来通り dense な interface を維持し、training だけ layout を変換する。

また device 上で `nonzero` を使って candidate を探す経路もなくした。位置は batch preparation 時点で分かっているので、その index をそのまま GPU へ渡す。

## 512 rowsを1回で学習する

packed layout にすると memory 使用量も下がった。

A100 bf16 の EAT で512 rowsを処理した場合、peak device memory は約2,997 MiBから2,209 MiBへ26.3%減った。

この余裕を使って、512 rowsの update を `128 x 4` ではなく `512 x 1` で処理するようにした。

変えたのは microbatch の切り方だけである。

- effective batch: 512 rowsのまま
- optimizer update数: 同じ
- row order: 同じ
- 学習で見る rows: 同じ
- model / loss / optimizer hyperparameters: 同じ

そのため、学習量を減らして速く見せているわけではない。

## 結果

主な測定結果は次のようになった。

| device / workload | before | after | gain |
| --- | ---: | ---: | ---: |
| A100 bf16, EAT campaign update | 4,053 rows/s | 15,501 rows/s | 3.82x |
| M2 MPS float32, EAT packed scoring | 0.9221 s/step | 0.7596 s/step | +17.6% |
| M2 CPU float32, EAT packed scoring | 1.916 s/step | 1.545 s/step | +19.3% |
| A100 bf16, EAT 1024-row packed scoring | 0.04975 s/step | 0.04054 s/step | +18.5% |

ここで重要なのは、3.82倍のほとんどを「packedにしたこと」だけで説明しないことである。

従来の `128 x 4` のまま A100 で candidate packing だけを入れると、むしろ約0.7%遅かった。小さい microbatch では dispatch overhead が大きすぎて、padding を減らした効果が見えない。

packing の役割は、無駄な candidate 計算と host synchronization を減らし、peak memory を下げて大きい microbatch を使えるようにしたことにある。そこへ `512 x 1` を組み合わせた結果が3.82倍になった。

## 計算結果が変わらないことも確認した

training path だけ packed にすると、dense な inference path と計算がずれる可能性がある。

そのため、candidate 数の異なる同じ rows を両方へ通し、policy logits、WDL output、全 parameter の gradient が一致することを test している。

packed と padded の変換には事前計算した index の gather を使い、同じ位置へ複数 gradient を atomic accumulation する経路も避けた。

microbatch の変更も、512 rowsを4分割して平均 loss を accumulate するか、一度に計算するかの違いで、学習する rows 自体は同じである。浮動小数点の reduction order による差以上の意味を持たせていない。

## 分かったこと

今回一番大きかったのは、GPU を使っているからといって GPU の演算能力が bottleneck とは限らないことだった。

EAT の supervised training では、細かい microbatch と可変長 candidate の padding が組み合わさり、GPU dispatch と memory の使い方が先に効いていた。

candidate を semantic object として扱う model 構造はそのままに、可変長であることを training layout 側でも維持することで、大きい batch を効率よく処理できるようになった。

これで今後の supervised bootstrap では、同じ update 数に使う時間をかなり短くできる。モデルの強さを改善する実験とは分けて、まず学習そのものに必要な wall time を減らせたのが今回の進捗になる。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
