---
title: "Splendor AIのモデル構造と特徴量"
date: "2026-08-13"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "game-ai", "neural-network"]
---

Splendor をプレイする AI を作っている。学習結果を書く前に、現在使っているニューラルネットワークが何を見て、何を予測しているかを整理しておく。

Splendor は、宝石トークンを集めてカードを購入するゲームだ。カードには得点と色があり、買ったカードの色は以後の購入コストを下げる永久割引になる。市場には複数のカードが公開され、カードを予約して手元に置くこともできる。最終的には得点を15点以上に伸ばすことを目指す。

そのため局面は、碁盤のような固定2次元画像というより、プレイヤー、カード、貴族、宝石、合法手の集合として表す方が自然だった。

## 入力は「局面」と「候補手」

現在の特徴量は大きく次のように分かれる。

```text
global state + public deck membership
bank tokens
players x 2
market cards x 12
nobles x 3
reserved cards x 6
legal actions x K
```

K は局面ごとに変わる合法手数である。

プレイヤーには得点、宝石、カードによる割引、予約枚数などを入れる。カードには色、得点、購入コストに加えて「現在の自分の割引を引いた実質コスト」も入れる。

候補手にも47次元の特徴を持たせている。たとえば宝石を取る、カードを買う、予約するといった手の種類、支払い、対象カードに加え、その手を実際に指した後の宝石、割引、得点、銀行側の宝石なども含める。

つまりモデルには「BUY という手」だけでなく、「この BUY をすると状態がどう変わるか」まで渡している。

## 25個の object を先に相互作用させる

状態側は最大25個の object token にする。

```text
1 global
1 bank
2 players
12 market cards
3 nobles
6 reserved cards
```

各 object を128次元に変換し、4-head self-attention を2 block 通す。その後で種類ごとに mean/max pooling し、256次元の state vector に落として residual MLP を2 block 通す。

```text
25 objects
   ↓
2 x self-attention
   ↓
mean/max pooling
   ↓
256-d state
   ↓
2 x residual MLP
```

以前は object を独立に encode してすぐ pooling していた。しかし Splendor では「相手が次に買えそうなカード」「自分の割引と市場カードのコスト」「カードの色と貴族条件」のような関係が重要になる。

先に pooling すると、その関係を後段の MLP が復元できない可能性がある。そこで現在は、object 同士を一度 attention させてから情報を圧縮している。

## policy と value を同じ state から出す

policy head は、固定個数の action class を出すのではなく、その局面の各合法手に1つずつ logit を出す。

候補手の特徴を96次元に encode し、対象となる market card、reserved card、noble があれば attention 後の object 表現も参照する。これを256次元の state と結合して候補手を score する。

```text
state 256
candidate 96
referenced object 96
       ↓
448 -> 256 -> 128 -> 1
```

value head は同じ state から loss / draw / win の3 logits を出す。探索時には softmax 後の確率から `P(win) - P(loss)` を局面評価として使える。

## なぜ特徴量生成を C++ にしたか

ニューラルネットワーク自体は PyTorch で書いているが、ゲームルールに依存する特徴量生成は C++ に置いている。

特に候補手の afterstate を作るには、その手を本当にゲーム状態へ適用する必要がある。これを Python 側でも実装すると、合法手生成、支払い、予約、終局判定などのルールが C++ と二重管理になる。

そこで C++ の正式なゲーム遷移をそのまま使って特徴量を作る。

```cpp
const TransitionResult after =
    apply_generated_candidate(state, config, catalog, candidate);
```

役割は次のように分けた。

```text
C++
  game rules
  legal actions
  feature extraction
  search
  runtime inference

Python / PyTorch
  neural network
  loss
  training
  ONNX export
```

学習した PyTorch model は ONNX に export し、対局や探索では C++ から ONNX Runtime で実行する。モデル構造を C++ と Python の両方に実装する必要はない。

## 実験中も同じモデルを使っている

最初の教師あり policy-value 学習で使った設定は、現在と同じ `entity width=128 / attention blocks=2 / state width=256 / state blocks=2` である。

この後の記事で学習、PUCT 探索、自己対局の結果が変わっていても、少なくともこの期間はモデル構造を途中で交換していない。モデルを固定し、データ、学習方法、探索の違いを一つずつ見ている。

---

この記事は、実装・実験記録をもとに筆者とAIが共同編集しています。
