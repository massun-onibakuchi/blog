---
title: "Splendor AIにEntity-Action Transformerを導入した"
date: "2026-09-13"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

EAT（Entity-Action Transformer）は、Splendor の盤面をsemantic entity、合法手をcandidateとして扱う policy-value model である。現在のmodelは888,324 parametersで、shared state encoderからpolicy headとWDL value headへ分岐する。

## stateをentityとして持つ

| entity | 主な情報 |
| --- | --- |
| player | tokens、bonuses、prestige、reserve count、starting-player relation |
| card | tier、bonus、prestige、cost、discounted cost |
| noble | requirements、playerごとの不足量 |
| bank | token supply |

各entityを128-dへ埋め込み、3層・4-headのTransformerで相互作用させる。deck cardsはtierごとにlearned-query poolingし、remaining-card countも残す。

## legal actionもcandidateとして表現する

candidateには effect type と6色のnet token deltaを持たせ、対象card / nobleは数値featureへコピーせずreferenceでstate entityを指定する。

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

referenceは「どのobjectを対象にするactionか」を明示し、cross-attentionはそのactionを盤面全体との関係で評価する。candidate同士のself-attentionは行わない。

## valueはshared stateから読む

value側では1つのlearned queryがencoded stateへcross-attentionし、loss / draw / winの3 logitsを出す。

```text
semantic entities
      |
 state transformer
      |
      +--------------------+
      |                    |
candidate-conditioned   value query
policy head             -> state attention
      |                    |
policy logits           WDL logits
```

入力はgame stateの一次情報を中心にし、単純に再計算できるsummaryは重複させない。一方、discounted costやnoble requirement deficitのような非線形relationは明示的に持たせる。

resource系featureは `/7`、prestigeは `/15` のようにsemantic unitごとにscaleも揃えた。

この構造を基準に、以後のsupervised bootstrap、search readiness、self-play実験を進めている。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
