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

各 entity を共通の hidden representation に変換し、その entity 集合に attention をかける。

これによって、盤面を1本の flat vector としてだけ扱うのではなく、盤面上に存在する object と object の関係を model が直接処理できるようにしている。

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
  -> policy score
```

policy は固定された action index だけを見て score を出すのではなく、現在の state と各 candidate action の関係から score を作る。

Splendor では legal action の数や対象が局面ごとに変わるので、action 自体を model の入力 object として扱える形にしておく意味は大きい。

## candidateからstateを見る

EAT の policy head では、candidate 側から state entities へ cross-attention を行う。

つまり、それぞれの legal action が「この行動を評価するためには盤面のどの情報を見るべきか」を candidate ごとに計算できる。

カード購入を評価するときと、token を取る行動を評価するときでは、重要になる state information は同じとは限らない。

一度作った共通 state vector だけから全 action を評価するのではなく、action ごとに state を読み直せるようにしている。

## valueには専用のpathを持たせる

value は、現在の局面から最終的な loss / draw / win を予測する。

policy と value は同じ state を見るが、必要な集約の仕方まで同一とは限らない。

そのため EAT では shared entity representation を利用しつつ、value 用の context を処理する専用 path を持たせている。

概念的には、

```text
semantic entities
  -> shared state representation

shared state representation
  -> candidate-conditioned policy path

shared state representation
  -> value-specific path
  -> loss / draw / win
```

という分離になる。

## 固定slot中心の表現からsemanticな表現へ

今回の変更で一番大きいのは、network の層数や parameter 数ではなく、state と action をどう model に見せるかを変えたことだと思っている。

従来の model では、feature engineering 側で盤面をかなり固定的な tensor layout に変換してから network に渡していた。

EAT では、カードや貴族を entity として、legal action を candidate として残したまま model に渡す。

そのため今後は、

- entity feature の追加や整理
- entity 間 attention の変更
- candidate-to-state cross-attention の変更
- action representation の改善
- value path の変更

といった改善を、ゲーム内の意味に対応した単位で行いやすくなる。

今回の進捗は、この Entity-Action Transformer を Splendor AI の新しい model family として導入したことになる。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
