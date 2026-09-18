---
title: "Splendor AIにEntity-Action Transformerを導入した"
date: "2026-09-13"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

Splendor をプレイする policy-value model として、EAT を使っている。

EAT は Entity-Action Transformer の略で、カードや貴族、プレイヤーなどを entity として表現し、legal action も candidate として明示的に表現して評価する model である。

盤面を1本の大きな vector に集約してから処理するのではなく、ゲーム内の object と action の意味をできるだけ残したまま Transformer に渡す。

## 盤面をentityとして表現する

Splendor の state は、主に次の entity で表す。

- player
- card
- noble
- token bank

player entity には、tokens、permanent bonuses、prestige、reserve count、starting-player relation を持たせる。

card entity には tier、bonus、prestige、cost を持たせる。さらに、そのカードを各 player が買うときに残る discounted cost も含める。

noble entity には requirements と、各 player にとって残っている requirement を持たせる。

bank は固定 supply と両 player の token から復元して entity にする。

こうして、カードならカード、player なら player という単位でゲームの一次情報を置く。

各 entity は hidden width 384 の representation に埋め込み、4層の Transformer block で相互作用させる。attention は8 head、feed-forward は1536幅にしている。

## 山札はtierごとにpoolingする

山札には多数の card entity がある。

それらをすべて同じ粒度で state attention に残すのではなく、tier ごとに learned query で pooling する。

ただし、カード構成を pooling すると「あと何枚残っているか」という情報が消えやすい。そのため pooled representation には tier ごとの remaining-card count も残す。

EAT では、山札の中身の構成と残り枚数の両方を state representation に渡す。

## actionもcandidateとして表現する

policy 側では、legal action ごとに candidate representation を作る。

candidate 自身が持つ数値は小さく、中心になるのは次の情報である。

- buy / reserve / resource-only の effect type
- 6色の net token delta

購入対象のカードや獲得する noble の属性を candidate にコピーすることはしない。

対象 object は、state 側の card entity / noble entity への reference で指定する。

カード購入なら、概念的には次のようになる。

```text
buy
net token delta
-> target card reference
-> optional noble reference
```

同じカードを異なる支払い方法で買える場合も、target card reference は同じまま、net token delta の違いで別の action として表現できる。

reference 自体を neural network の数値 feature として学習させるわけではない。reference は、どの entity representation を取り出すかを指定する routing information として使う。

## policy headは参照先を読んでからstateを見る

policy head は candidate を評価するとき、まず reference で指定された card / noble の encoded representation を state から取り出す。

その representation で candidate query を条件付けし、candidate から state 全体へ cross-attention を行う。

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

reference と cross-attention は別の役割を持つ。

reference は「この action はどの object を対象にしているか」を明示する。

cross-attention は、その action を player、他の cards、nobles、bank など局面全体との関係で評価する。

最後に candidate representation と attended state を使って、legal action ごとに1つの policy logit を出す。

candidate 同士では self-attention を行わない。それぞれの action が独立に state を読み取る構造にしている。

## value headはvalue tokenでstateを読む

value は、現在の局面から actor-relative な loss / draw / win を予測する。

policy と value は entity encoder を共有するが、その後の readout は分けている。

value 側では learned value token を encoded state に追加し、value 専用の Transformer block で局面全体を読む。

その readout を MLP に通して、loss / draw / win の3 logitsを出す。

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

value 用に別の global summary vector を入力するのではなく、value に必要な情報も state entities から読む。

## 一次情報を中心にする

EAT の input は、semantic state の一次情報を中心にしている。

player の purchased-card count は permanent bonuses の合計から分かり、total token count は6色の token vector の合計から分かる。prestige 差や15点までの距離のような単純な summary も、元の player state から計算できる。

こうした値は別 feature として重複させない。

一方で、単純な線形和では作りにくい relation は明示的に残す。

card cost から player bonus を色ごとに引いて0で下限を取る discounted cost や、noble requirement の不足量などである。

どこまでを一次情報として持たせ、どこからを network に組み合わせさせるかを、ゲームの意味に沿って分けている。

## 同じ意味の量は同じscaleにする

同じ semantic unit は、entity の種類が違っても同じ scale に揃える。

prestige は player でも card でも `/15` を使う。

token、cost、bonus、requirement、net token delta のようにゲーム中で足し引きされる resource 系の量は `/7` を共通の scale にする。

shared embedding に入る前から単位を揃え、model が object type ごとに倍率の違いまで学習しなくてよい形にしている。

EAT は、semantic entity state と reference-based candidate を shared Transformer で処理し、candidate-conditioned policy head と value-token readout に分岐する policy-value model である。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
