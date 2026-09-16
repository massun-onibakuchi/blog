---
title: "Splendor AIのEATで、行動がカードを参照する形にした"
date: "2026-09-16"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

Splendor の policy-value model として EAT（Entity-Action Transformer）を使っている。

EAT は、カードやプレイヤーを entity、合法手を candidate として Transformer に渡す model である。

今回、この candidate の表現をかなり小さくした。

ポイントは、カードを買う action の中にカードの cost や prestige をもう一度コピーするのをやめて、「どの card entity を対象にしているか」を参照する形にしたことである。

## 同じカード情報を何度も持たせていた

カードを買う行動を考える。

行動を評価するには、対象カードの tier、bonus、prestige、cost などが必要になる。

しかし、それらはすでに state 側の card entity に入っている。

candidate 側にも同じ値を持たせると、同じゲーム上の事実が state と action の2か所に存在することになる。

同じカードを異なる支払い方法で買える場合は、そのカード情報が candidate の数だけ複製される。

EAT は state を entity として encode しているので、candidate にカード属性をコピーするより、その encoded card entity を直接使う方が自然である。

## candidateは「何をするか」だけを持つ

現在の candidate の数値表現は、effect type と resource movement が中心になっている。

```text
candidate
  effect: buy / reserve / resource-only
  net token delta: 6 colors
  target card: reference
  chosen noble: reference
```

例えば market のカードを買う場合、candidate は `buy` と支払い後の net token delta を持ち、対象カードは card entity への reference で指定する。

購入後に貴族を獲得するなら noble entity も参照する。

カードを予約する場合も同様で、candidate 自身に対象カードの属性を複製しない。

reference の番号そのものを neural network の feature として学習させるわけではない。reference は、state のどの entity representation を取り出すかを示す routing information である。

## policy headで参照先を取り出す

state 側では、カード、プレイヤー、貴族などを Transformer で encode している。

policy head は candidate を評価するとき、まず reference で指定された card / noble の representation を state から gather する。

それを candidate query に加えてから、state 全体へ cross-attention する。

```text
candidate semantics
      +
referenced entity representations
      |
 candidate query
      |
 cross-attention to state
      |
 policy logit
```

ここで reference と cross-attention は別の仕事をしている。

reference が伝えるのは「この action はこのカードを買う」という対象の指定である。

cross-attention が見るのは、その action と局面全体の関係である。自分と相手の token、bonus、他の market cards、nobles などを candidate ごとに読み取る。

対象を直接指定しつつ、局面全体との関係も Transformer に任せる構造になっている。

## resource movementも1つの量にした

購入 action では token の増減と payment を別々に持たせず、raw token unit で

`net token delta = token delta - payment`

を計算してから model に渡す。

これによって同じカードに対する複数の支払い方法も区別できる。

例えば同じカードを「赤 + gold」で払う候補と「緑 + gold」で払う候補は、target card reference は同じでも net token delta が異なるため、別の candidate になる。

## state側も一次情報を中心にした

同じ考え方で state entity からも、単純に復元できる summary は減らした。

player の購入カード枚数は permanent bonuses の合計で分かる。total token count も token vector の合計で分かる。bank balance は固定 supply から両プレイヤーの token を引けば復元できる。

このような情報を別 feature として重複させるより、元になる semantic facts を1か所に置く。

一方、card cost と player bonus の色ごとの関係から作る discounted cost や、noble requirement の不足量のような非線形な関係は残している。

単に feature 数を減らしたいわけではなく、どの事実を model input の source of truth にするかを整理した。

## 同じ意味の量は同じscaleにする

表現を整理すると、正規化の単位の違いも気になった。

例えば prestige は player でも card でも同じ点数であり、token、cost、bonus、requirement はゲーム中で実際に足し引きされる同じ resource unit である。

そこで現在は、prestige は15点を基準にし、token / cost / bonus / requirement / net token delta は `/7` を共通の scale にしている。

同じ値を entity の種類によって別の倍率にすると、shared embedding は「これは player だから倍率を変換する」という処理まで学ぶ必要がある。

意味が同じ量なら、入力時点でも同じ unit にしておく方が分かりやすい。

## 今回の狙い

この変更だけで model が強くなった、という結果はまだない。

狙いは、EAT が relational model であることを入力表現にも反映することにある。

カードの情報は card entity に置く。player の状態は player entity に置く。action は effect と resource movement を持ち、必要な object を参照する。

同じ情報を複数の feature に展開して network に渡すのではなく、一次情報を一度だけ表現し、その関係を attention で学習する構造にした。

この表現で学習効率や最終的な強さがどう変わるかは、これから別に確認していく。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
