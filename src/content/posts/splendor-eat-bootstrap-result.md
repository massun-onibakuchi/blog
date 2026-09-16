---
title: "Splendor AIにEntity-Action Transformerを導入した"
date: "2026-09-13"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

Splendor をプレイする policy-value model を作っている。

現在は EAT という model を使っている。

EAT は Entity-Action Transformer の略で、カードや貴族、プレイヤーなどを entity として表現し、legal action も candidate として明示的に表現して評価する model である。

state と action の意味をできるだけ残したまま neural network に渡し、policy と value を別の readout で計算する構造にしている。

## 盤面をentityとして表現する

Splendor の状態には、性質の異なる object がある。

- 場に出ているカード
- 山札に残っているカード
- プレイヤーが予約したカード
- 貴族
- プレイヤー
- token bank

EAT では、これらを semantic entity として扱う。

player entity には tokens、permanent bonuses、prestige、reserve count、starting-player relation を持たせる。card entity には tier、bonus、prestige、cost と、両プレイヤーの discount を適用した残り cost を持たせる。noble entity には requirements と、両プレイヤーにとって残っている requirement を持たせる。

bank は別の独立した状態として二重管理せず、固定 supply から両プレイヤーの token を引いて復元して entity にする。ゲーム内の同じ事実を複数の入力で別々に持たせないためである。

各 entity は hidden width 384 の representation に埋め込み、4層の self-attention block で相互作用させる。attention は8 head、feed-forward は1536幅にしている。

山札に残っているカードは tier ごとに pooling する。ただし、カード構成を平均的にまとめるだけでは「あと何枚残っているか」が消えるので、pooling した representation には tier ごとの残り枚数も持たせている。

## actionもcandidateとして表現する

policy 側では、legal action ごとに candidate representation を作る。

candidate 自身が持つ数値はかなり小さい。

- buy / reserve / resource-only の effect type
- 6色の net token delta

購入対象のカードや獲得する貴族の属性を candidate にコピーするのではなく、その card entity / noble entity を参照する。

例えばカード購入なら、candidate は概念的に次のようになる。

```text
buy
net token delta
-> target card reference
-> optional noble reference
```

`net token delta` は token の取得と支払いを別々に持たせず、raw unit で差を取ってから1回だけ正規化する。

Splendor では同じカードでも支払い方法が複数あるため、同じ target card を参照する candidate でも net token delta が違えば別の行動として表現できる。

## policy headは参照先を読んでから盤面を見る

policy head では、まず candidate が参照している card / noble の encoded representation を state から取り出す。

その情報で candidate query を条件付けしたあと、candidate から state 全体へ cross-attention を行う。

```text
candidate semantics
      +
referenced card / noble
      |
 candidate query
      |
state cross-attention
      |
 policy logit
```

参照と cross-attention は役割が違う。

参照は「この行動がどのカードや貴族を対象にしているか」を伝える。cross-attention は、その行動を現在の盤面全体との関係で評価する。

これによって target card の tier、cost、prestige などを candidate ごとに複製せず、state 側の entity representation をそのまま再利用できる。

candidate 同士では self-attention を行わない。それぞれの legal action が独立に state を読み、1つの policy logit を出す。

## value headはstateだけを読む

value は、現在の局面から最終的な loss / draw / win を予測する。

policy と value は entity encoder を共有するが、その後の読み方は分けている。

value 側では learned value token を encoded state に追加し、value 専用の Transformer block で局面全体を readout する。その出力を MLP に通して、actor-relative な loss / draw / win の3 logitsを出す。

```text
semantic entities
      |
 state transformer
      |
      +-------------------------+
      |                         |
candidate-conditioned      value token
policy head                readout
      |                         |
policy logits              WDL logits
```

局面全体を別の summary vector として直接 value head に渡す経路は持たせていない。value に必要な情報も state entities から読む構造にしている。

## 一次情報を中心にする

EAT の入力では、元の semantic state から正確に計算できる summary は基本的に持たせない。

例えば player の購入カード枚数は permanent bonuses の合計で分かり、total token count は6色の token vector の合計で分かる。得点差、15点までの距離、game ply、action 後の actor/bank state といった summary も model input にはしていない。

一方で、単純な線形和では作りにくい関係は残している。card cost から player bonus を色ごとに引いて0で下限を取る discounted cost や、noble requirement の不足量などである。

正規化も、同じ意味の量には同じ unit を使う。prestige は player でも card でも15点を基準にし、token、cost、bonus、requirement、net token delta のように足し引きされる量は同じ `/7` scale を使っている。

この model で中心にしたいのは、手作業で summary を増やすことではなく、カード、プレイヤー、貴族、resource movement といったゲームの一次情報を relational model が組み合わせることである。

現在の EAT は、この semantic entity state と reference-based candidate を shared Transformer で処理し、candidate-conditioned policy と value-token readout に分岐する policy-value model になっている。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
