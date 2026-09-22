---
title: "Splendor AIの手を段階化してみたら、補充後の追加判断は4096手中2回だった"
date: "2026-09-22"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "reinforcement-learning"]
---

Splendor をプレイする EAT（Entity-Action Transformer）では、これまで1手をかなり大きな単位で選んでいた。

例えば表向きのカードをリザーブしてトークンが10枚を超える場合、現在の policy は「どのカードを取るか」と「最後にどのトークンを返すか」をまとめた complete candidate の中から1つを選ぶ。

この方式は単純だが、Splendor の実際の手順とは少し違う。

表向きカードを取ると市場が補充され、その新しいカードを見たあとでトークン返却や貴族の選択を行える。つまり、1手の途中で新しい情報が増える。

そこで action を段階化し、MAIN → refill → RETURN → NOBLE のように条件付きで選ぶ方式を実装してみた。

今回はまだ学習や対局比較ではなく、その方式を作る価値がありそうかを見る Stage 0 の計測である。

結果から書くと、候補数は4.7%減ったが実行時間はほぼ変わらなかった。また、補充後の情報を使って追加判断できる局面は、このサンプルでは4,096ターン中2ターンだけだった。

## これまでのEATは1ターンをまとめて選ぶ

現在の EAT は、合法手を candidate として列挙し、それぞれに score を付ける。

単純なトークン取得なら問題ないが、Splendor では1つの physical turn の中に複数の選択が入る場合がある。

例えば、

- 表向きカードをリザーブする
- 市場に新しいカードが補充される
- 10トークンを超えたので返す色を選ぶ
- 条件を満たした貴族が複数いれば1枚選ぶ

という流れがあり得る。

従来方式では、これらの組み合わせを最初から complete candidate として作る。

段階化した方式では、まず MAIN を選び、その結果として必要になった RETURN や NOBLE だけを後から選ぶ。

この変更には2つ期待していたことがある。

1つは、不要な組み合わせを最初から列挙しなくてよくなること。

もう1つは、カード補充のような途中で得た情報を、その後の判断に使えるようになることである。

## 3つの方式を用意した

比較用に3つの arm を実装した。

| arm | 選び方 | RETURN / NOBLEで使える情報 |
| --- | --- | --- |
| C | complete candidate を最初に1回選ぶ | 最初の公開情報だけ |
| F0 | MAIN と cleanup を分ける | refill 前に cleanup も決める |
| F1 | MAIN と cleanup を分ける | refill を見てから cleanup を選ぶ |

C は現在方式の control である。

F0 は action factorization だけを変え、情報量は C に合わせる。これで「分割したこと自体」の効果を比較できる。

F1 は実際のゲーム順序に合わせ、補充されたカードを見てから RETURN / NOBLE を選べる。

モデル側には `decision_context` という5次元の入力を追加した。RETURN なのか NOBLE なのか、どの tier の refill が pending なのかを表す。

追加部分は acting player の entity representation に入る小さな線形層だけで、parameter 数は 888,324 から 888,964 になった。context が全部0なら baseline と同じ関数になるようにしている。

## まず候補数と実行コストを測った

いきなり3モデルを学習する前に、そもそも staged decision がどのくらい使われるのかを測った。

4,096の turn-start state を、71ゲームから収集した。ゲームごとに depth-three の minimax teacher と point-rush heuristic を交互に使っている。

3つの arm は同じ parent state から同じ complete leaf を実行するようにしてある。そのため、ここで測っている差はプレイ内容の違いではなく、候補の作り方と model evaluation の差である。

Apple M2 CPU、Torch 4 threads、float32 で測った結果は以下だった。

| quantity | result |
| --- | ---: |
| C の complete candidate 数 | 平均 26.0 |
| F0/F1 の MAIN candidate 数 | 平均 24.8 |
| candidate row の削減 | 4.7% |
| C の state-encoder call | 1.000 / turn |
| staged の state-encoder call | 1.0007 / turn |
| C の complete turn | 1.37 ms |
| F0 の complete turn | 1.38 ms |
| F1 の complete turn | 1.37 ms |

候補は減ったが、時間はほとんど変わらなかった。

このサイズの EAT では、25前後の candidate score を少し減らすより、局面全体を encode する固定コストの方が大きいようだった。

少なくとも現在の model size と CPU batch-of-one inference では、staging を「候補数を減らして高速化する方法」として採用する理由は弱くなった。

## 補充後の追加判断はかなり少なかった

もう1つ知りたかったのは、F1 のように途中で得た情報を使える場面がどのくらいあるかだった。

市場の refill 自体は珍しくない。今回のサンプルでは58.7%の turn で public refill が発生した。

しかし、そのあとに実際の policy が discretionary RETURN / NOBLE を必要とした turn は3 / 4,096だけだった。

さらに「refill を見たあとで cleanup を選べる」という F1 と F0 の違いが出る turn は2 / 4,096だった。

候補集合だけを見ると reserve overflow が可能な parent は2.2%、複数 noble を選べる parent は2.3%あった。それでも実際に選ばれた trajectory 上ではほとんど cleanup に到達しなかった。

つまり、情報を使えるときの価値が小さいと分かったわけではない。

分かったのは、今回の teacher / heuristic mixture では、その情報を使えるイベント自体がかなり疎だったということである。

この3イベントは3つの別ゲームに分かれていて、game-clustered bootstrap の95%区間は0〜0.17%だった。件数が少ないので、0.1%未満の真の頻度を精密に推定できるデータではない。

## いきなり学習実験へ進まないことにした

Stage 0 は staged decision の強さを測る実験ではない。

trained checkpoint もなく、arena result もなく、playing strength が上がったという結果はまだない。

ただ、次にGPUを使って3 armを学習する前に、2つの前提をかなり絞れた。

1つ目は、factorization による計算量削減は現在条件では小さいこと。

2つ目は、post-refill recourse の自然な exposure が今回の behavior mixture では非常に少ないこと。

特に2つ目は重要で、イベントがほとんど起きない分布で大きな training campaign を回しても、情報を使う能力を十分に学習できない可能性がある。

そのため、情報利用の arm に本格的な計算資源を使う前に、現在の強い policy に近い分布でも同じくらい疎なのかを再計測する方針にした。

一方で staged surface 自体は残している。

将来 blind reserve を入れる場合、引いた hidden card は acting player だけが手の途中で知る情報になる。その場合、先に suffix を全部 commit する方式より、revealed information のあとで RETURN / NOBLE を選べる staged representation の意味が大きくなる。

そのため現在の問いは、「no-blind ですぐ強くなるか」だけではなく、「将来必要になる information boundary を正しく表現しつつ、現在の EAT に対して非劣性で使えるか」に変わってきている。

次は factorized arm が atomic baseline に対して measurable な strength loss を持たないかを、paired training / play で測る Stage 1 を準備している。こちらはまだ preregistration と harness の段階で、結果は出ていない。

今回の Stage 0 は派手な改善ではなかったが、候補削減と information recourse の両方について、先に大きな実験を回す理由を実測で絞れたのが成果だった。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
