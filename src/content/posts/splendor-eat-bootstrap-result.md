---
title: "Splendor AIにEntity-Action Transformerを導入した"
date: "2026-09-13"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

Splendor をプレイする policy-value model を作っている。

現在は EAT という model を使っている。

EAT は Entity-Action Transformer の略で、カードや貴族などの盤面要素を entity として表現し、legal action も candidate として明示的に表現して評価する model である。

state と action の意味をできるだけ保ったまま neural network に渡し、policy と value を別の readout で計算する構造にしている。

## 盤面をentityとして表現する

Splendor の状態には、性質の異なる object がある。

- 場に出ているカード
- 山札に残っているカード
- プレイヤーが予約したカード
- 貴族
- プレイヤー
- token bank

EAT では、これらを semantic entity として扱う。

例えばカードなら、tier、bonus、prestige、cost など、そのカード自身の意味を表す feature を持たせる。player entity には prestige や購入カード枚数など、プレイヤー自身の状態を入れる。

各 entity は hidden width 384 の representation に埋め込み、4層の self-attention block で相互作用させる。attention は8 head、feed-forward は1536幅にしている。

これによって、盤面上に存在する object と object の関係を model が直接処理できる。

山札に残っているカードは90枚分をそのまま state attention に流さず、tier ごとの learned query で semantic に pooling してから state representation に入れる。

## contextは局面全体の情報だけを持つ

entity とは別に、局面全体に属する小さな context input を持っている。

現在の context は8個で、次の情報だけを入れている。

| context | 意味 |
| --- | --- |
| endgame triggered | 終局ラウンドに入っているか |
| actor is starting player | 手番側が starting player か |
| actor triggered endgame | 手番側が終局条件を発火したか |
| opponent triggered endgame | 相手が終局条件を発火したか |
| reserve-without-gold filter | 予約ルールの設定 |
| tier 1 deck size | tier 1 の残り枚数 |
| tier 2 deck size | tier 2 の残り枚数 |
| tier 3 deck size | tier 3 の残り枚数 |

prestige、購入カード枚数など player entity に属する情報は entity 側を authoritative source にしている。そこから計算できる差分や距離を context として重複して渡さない。

同様に、game ply や maximum plies のような episode execution 側の値も trainable input には含めていない。

context は entity で表現しにくい局面全体の relation やルール状態を補うための入力、という役割に限定している。

## actionもcandidateとして表現する

policy 側では、legal action ごとに candidate representation を作る。

カード購入なら購入対象のカード、予約なら予約対象、貴族を獲得する action ならその貴族など、action が参照している情報を candidate 側に持たせる。

概念的には次のような構造になる。

```text
semantic entities
  -> state attention

legal action candidates
  -> candidate representation
  -> stateへのcross-attention
  -> policy head
```

policy は固定された action index だけを見て score を出すのではなく、現在の state と各 candidate action の関係から score を作る。

Splendor では legal action の数や対象が局面ごとに変わるので、action 自体を model の入力 object として扱える形にしている。

## policy headはcandidateごとにscoreを出す

EAT の policy head では、candidate 側から state entities へ cross-attention を行う。

それぞれの candidate embedding を query、state representation を key/value として使い、各 legal action が必要な state information を読み取る。

その後、元の candidate embedding と cross-attention で得た representation を連結し、MLP で1つの logit に落とす。

```text
candidate embedding
      +
state cross-attention result
      |
   concat
      |
     MLP
      |
 policy logit
```

このため policy head は、legal action ごとに state を読み、その action 専用の score を出す。

## value headは専用のreadoutを持つ

value は、現在の局面から最終的な loss / draw / win を予測する。

policy と value は entity trunk を共有するが、その後の head は分けている。

value 側では learned value token を shared state representation に追加し、value 専用の Transformer block で state 全体を readout する。

それとは別に、8個の context features を小さな MLP で hidden representation に変換する direct context path を持つ。

最後に、

```text
value-token readout
        +
direct context representation
        |
      concat
        |
       MLP
        |
loss / draw / win logits
```

として3クラスの WDL logits を出す。

つまり EAT は、entity encoder までは policy/value で共有し、その先で policy は candidate-conditioned cross-attention、value は専用 readout + compact context path という別の head architecture に分かれる。

## semanticな単位でmodelを組む

EAT の中心は、state と action をゲーム内の意味に対応した単位で model に渡すことにある。

カードや貴族、プレイヤーを entity として、legal action を candidate として残し、局面全体にだけ属する情報を小さい context に分離している。

そのため、

- entity feature
- entity 間 attention
- deck pooling
- candidate representation
- candidate-to-state cross-attention
- policy scorer
- value readout
- context path

を、それぞれ意味のある component として改善できる。

現在の EAT は、この Entity-Action Transformer を Splendor AI の policy-value model family として実装したものになる。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
