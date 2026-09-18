---
title: "Splendor AIのEAT学習を3.8倍速くした"
date: "2026-09-16"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "training"]
---

Splendor をプレイする policy-value model を作っている。

現在使っている EAT（Entity-Action Transformer）は、局面に存在するカードやプレイヤーを entity、合法手を candidate として扱う model である。

今回は model の構造や学習目標を変えず、教師あり学習の1 updateにかかる時間をかなり短くできた。

A100 上では、同じ512 rowsの update が 4,053 rows/s から 15,501 rows/s になった。約3.82倍である。

## 遅かった原因

EAT の policy は、局面ごとの legal action を candidate として評価する。

Splendor では legal action の数が局面ごとに違う。今回の学習データでは平均26.8個だったが、最大では195個あった。

普通に batch を作ると、candidate tensor は batch 内で一番多い局面に合わせて padding される。

例えば、候補が20個しかない局面でも、同じ batch に100個の候補を持つ局面があれば、100個分の領域を確保する。存在しない80個は mask されるが、途中の計算ではその padding が無駄になる。

さらに従来は、512 rowsの1 updateを128 rowsずつ4回に分けて処理していた。

この2つが組み合わさって、GPU は大きな行列演算をまとめて処理するより、小さい処理を何度も起動する時間にかなり使われていた。

## candidateを詰めて持つ

そこで training では、candidate を padded grid のまま処理せず、実際に存在する candidate だけを連続して並べるようにした。

```text
padded
row 0: A B C - -
row 1: D E F G H
row 2: I J - - -

packed
A B C D E F G H I J
```

policy score を計算したあとだけ、各 candidate が元のどの局面・位置に属していたかを使って `[batch, width]` に戻す。

これで、存在しない candidate に対する計算をかなり減らせる。

同時に GPU memory の使用量も減り、512 rowsを4分割せず一度に処理できるようになった。

## 高速化の要因

結果は次の通りだった。

```text
before:  4,053 rows/s
after:  15,501 rows/s
speedup: 3.82x
```

ただし、3.82倍を「paddingを消したから速くなった」とだけ解釈するのは正しくない。

candidate を packed にするだけでは、従来と同じ小さい microbatch の条件ではほとんど速くならなかった。

大きかったのは、padding を減らして memory に余裕を作り、そのうえで512 rowsを一度に処理できるようにしたことだった。

つまり今回の改善は、

```text
可変長 candidate の無駄な paddingを減らす
        +
小さい microbatch を何度も回すのをやめる
```

という組み合わせで高速化している。

## モデルは変えていない

今回変えたのは、同じ学習をGPUへどう載せるかである。

EAT の entity representation、candidate-conditioned policy、value head、loss、optimizer、学習する row の内容は変えていない。

そのため今回の3.82倍は model quality の改善ではなく、同じ supervised training をより短い時間で回せるようになったという進捗になる。

大きめの EAT を今後何度も学習するなら、architecture の改善だけでなく、1回の学習に何時間かかるかも研究速度そのものを左右する。

今回の変更で、その反復コストをかなり下げられた。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
