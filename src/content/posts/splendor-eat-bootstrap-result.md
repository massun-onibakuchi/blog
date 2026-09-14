---
title: "Splendor AIにEntity-Action Transformerを導入した"
date: "2026-09-13"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

Splendor をプレイする policy-value model を作っている。

今回は、新しい model として EAT を導入した。

EAT は Entity-Action Transformer の略で、カードや貴族などの盤面要素を entity として表現し、legal action も candidate として明示的に表現して評価する model である。

これまでの model は、ゲーム状態をあらかじめ決めた tensor layout に変換し、その fixed representation から policy と value を出していた。

EAT では、state と action の構造をもう少し直接 model に見せる。

## 盤面をentityとして表現する

Splendor の状態には、性質の異なる object がある。

- 場に出ているカード
- 山札に残っているカード
- プレイヤーが予約したカード
- 貴族
- プレイヤー自身の状態

EAT では、これらを semantic entity として扱う。

例えばカードなら、単に card ID の位置だけを入力するのではなく、tier、bonus、prestige、cost など、そのカード自身の意味を表す feature を持たせる。

各 entity は hidden width 384 の representation に埋め込み、4層の self-attention block で相互作用させる。attention は8 head、feed-forward は1536幅にしている。

これによって、盤面を1本の flat vector としてだけ扱うのではなく、盤面上に存在する object と object の関係を model が直接処理できるようにしている。

山札に残っているカードは、そのまま90枚分を state attention に流すのではなく、tier ごとに learned query で集約してから state representation に入れる。

## actionもcandidateとして表現する

policy 側では、legal action ごとに candidate representation を作る。

カード購入なら購入対象のカード、予約なら予約対象、貴族を獲得する action ならその貴族など、action が参照している entity の情報を candidate 側へ持たせる。

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

Splendor では legal action の数や対象が局面ごとに変わるので、action 自体を model の入力 object として扱える形にしておく意味は大きい。

## policy headはcandidateごとにscoreを出す

EAT の policy head では、candidate 側から state entities へ cross-attention を行う。

それぞれの candidate embedding を query、state representation を key/value として使い、各 legal action が必要な state information を読み取る。

その後、元の candidate embedding と cross-attention で得た representation を連結し、小さな MLP で1つの logit に落とす。

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

このため、policy head は「局面全体を1つの vector に圧縮してから全 action をまとめて分類する」形ではない。legal action ごとに state を読み、その action 専用の score を出す。

## value headは別のreadoutを持つ

value は、現在の局面から最終的な loss / draw / win を予測する。

policy と value は同じ entity trunk を共有するが、head は分けている。

value 側では learned value token を shared state representation に追加し、value 専用の Transformer block で state 全体を readout する。さらに、手番や終局状態などを持つ global context features を別の MLP で直接変換する経路も持つ。

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

つまり EAT は、entity encoder までは policy/value で共有し、その先で policy は candidate-conditioned cross-attention、value は専用 readout + direct context という別の head architecture に分かれる。

## 固定slot中心の表現からsemanticな表現へ

今回の変更で一番大きいのは、network の層数や parameter 数ではなく、state と action をどう model に見せるかを変えたことだと思っている。

従来の model では、feature engineering 側で盤面をかなり固定的な tensor layout に変換してから network に渡していた。

EAT では、カードや貴族を entity として、legal action を candidate として残したまま model に渡す。

そのため今後は、

- entity feature の追加や整理
- entity 間 attention の変更
- deck pooling の変更
- candidate-to-state cross-attention の変更
- policy scorer の変更
- value readout / context path の変更

といった改善を、ゲーム内の意味や model component に対応した単位で行いやすくなる。

今回の進捗は、この Entity-Action Transformer を Splendor AI の新しい model family として導入したことになる。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
