---
title: "Splendor AIの新しいEntity-Action Transformerを学習したが、既存モデルにはまだ勝てなかった"
date: "2026-09-13"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

Splendor をプレイする policy-value model を作っている。

これまでは、比較的小さい policy-value model を PUCT 探索から呼び出して使っていた。

今回はそこからかなり構造を変えて、EAT と呼んでいる新しい model を実装し、実際に学習して対局まで通した。

EAT は Entity-Action Transformer の略で、カードや貴族などの盤面要素を semantic entity として扱い、legal action も candidate entity として直接評価する model である。

結果から先に書くと、学習自体はかなり明確に成功した。しかし、比較に使った既存の learned reference にはまだ勝てなかった。さらに推論も遅かった。

新しい architecture が end-to-end で学習・探索できるところまでは確認できたが、現時点で置き換える理由はない、という結果になった。

## EATで何を変えたか

以前の model では、盤面を固定された tensor layout に変換し、その state representation から policy と value を出していた。

EAT では、残っているカード、場のカード、予約カード、貴族などを意味を持った entity として並べる。

山札の残りカードも「90個のID位置が残っているか」ではなく、tier、bonus、prestige、cost などを持つ card entity として表現する。

legal action も、固定slotへの参照だけでなく、その行動が対象にしているカードや貴族の意味を candidate feature に含める。

model 側では、

```text
semantic entities
  -> permutation-aware state attention

legal action candidates
  -> stateへのcross-attention
  -> policy score

state/context
  -> value-specific path
  -> loss / draw / win
```

という形にしている。

parameter 数は約1,102万になった。

この方向は EAT-GAZ と呼んでいる研究案の一部だが、今回試したのは EAT model の有限 supervised bootstrap と clean PUCT までで、Gumbel AlphaZero や本格的な self-play learning まで進めた実験ではない。

## まず小さいbootstrapを最後まで通した

いきなり大規模学習を行わず、既存の top-k-minimax teacher data から1,024 groupsを固定して使った。

Splendor では同じ初期配置を先手・後手を交換して2局行い、この2局を1 groupとして扱っている。

split は次の通り。

| split | groups | rows |
| --- | ---: | ---: |
| train | 768 | 89,868 |
| validation | 128 | 14,982 |
| test | 128 | 14,918 |
| total | 1,024 | 119,768 |

policy target は既存 teacher の分布、value target は最終的な loss / draw / win を使った。

optimizer は AdamW、effective batch size は256、学習は1,500 updatesで固定した。

training は CPU で約3,113秒かかった。

最初と最後の sampled update の loss は次のようになった。

```text
update 1
policy loss  3.1548
WDL loss     1.3010
joint loss   3.8053

update 1500
policy loss  0.9504
WDL loss     0.5515
joint loss   1.2261
```

これは training diagnostic なので、これだけで汎化したとは判断しない。

checkpoint は事前に決めた通り、ちょうど1,500 updates後のものを選んだ。validation や arena の結果を見て選び直してはいない。

## 未知のtest dataでも大きく改善した

選択後に固定 test set 全体で評価した。

policy は teacher distribution との cross entropy、value は terminal WDL の cross entropy と Brier score を見た。

| test metric | initial | trained |
| --- | ---: | ---: |
| policy CE | 3.1965 | 1.0069 |
| policy KL | 2.5159 | 0.3262 |
| WDL CE | 1.3067 | 0.6134 |
| WDL Brier | 0.8158 | 0.4205 |

complete group 単位で1,000回 bootstrap したところ、すべての draw で trained checkpoint が initial checkpoint より良かった。

ゲーム終了までの残り手数で分けても、1-8、9-16、17-32、33+ の全 bucket で policy と value の両方が改善した。

少なくとも「この model は1,500 updatesで teacher signalを吸収できない」という問題ではなかった。

## 初期値との対局ではほぼ一方的に勝った

次に、同じ EAT architecture の initial checkpoint と trained checkpoint を直接対局させた。

まず search を使わず、model の policy logit が最大の行動を選ぶ raw-policy arena を行った。

```text
trained EAT vs initial EAT
raw-policy pair score = 0.9717
95% interval = [0.9615, 0.9818]
```

32 simulation の clean PUCT でも、

```text
trained EAT vs initial EAT
PUCT-32 pair score = 0.9941
95% interval = [0.9855, 1.0028]
```

となった。

offline metricだけが下がったのではなく、学習したweightによって実際の行動選択も大きく改善している。

ここまではかなり良い結果だった。

## しかし既存のlearned referenceには届かなかった

次に、以前の Markov race feature 実験で学習した policy-value model の1つを reference として比較した。

この reference は「最強モデルとして選抜したchampion」ではなく、比較に使える既存の learned model である。そのため絶対的なランキングではないが、現在の EAT が実用的な水準に届いているかを見る基準にはなる。

raw-policy arena は、

```text
trained EAT vs reference
pair score = 0.3945
95% interval = [0.3519, 0.4372]
```

だった。

PUCT-32 ではさらに差が広がった。

```text
trained EAT vs reference
pair score = 0.3037
95% interval = [0.2626, 0.3448]
```

どちらも interval 全体が0.5より下にある。

つまり、新しい architecture は初期値からは明確に学習できたが、この有限 bootstrap だけでは既存 reference の playing strength に届かなかった。

## 推論速度もまだ厳しい

もう1つ大きかったのが inference cost だった。

reference を32 simulationで探索したときの平均 decision time は約0.00628秒だった。

EAT は最小の4 simulationでも約0.0125秒で、約1.99倍かかった。

| evaluator | search budget | sec / decision | reference比 |
| --- | ---: | ---: | ---: |
| reference | 32 | 0.00628 | 1.00x |
| EAT | 4 | 0.01252 | 1.99x |
| EAT | 8 | 0.02200 | 3.50x |
| EAT | 32 | 0.07989 | 12.73x |

事前には、reference の平均時間に対して0.8〜1.25倍へ入る EAT budget があれば、matched-time arena も行う予定だった。

しかし最小の EAT-4 ですでに約1.99倍だったため、該当する budget がなかった。ここは結果を見て新しい budget を追加せず、matched-time comparison は未実行のままにした。

## 今回分かったこと

今回の結果から、EAT architecture について少なくとも次のところまでは確認できた。

semantic entity/action encodingから PyTorch training、ONNX export、native evaluator、PUCT、完全な対局まで同じ checkpoint を通せる。

1,500 updates の supervised bootstrap でも、initial modelからは offline metricとplaying strengthの両方を大きく改善できる。

一方で、それは「EATの方が既存modelより強い」という意味ではなかった。

現在の学習量、teacher source、objectiveでは reference に負けていて、inference cost も高い。

今回の実験だけでは、その差が model の inductive bias、学習量、独立した教師outcome数、optimization、source distribution のどれから来ているかは切り分けられない。

なので、この checkpoint は失敗として捨てるのではなく、fresh EAT の baseline として残すことにした。ただし既存 reference を置き換えたり、同じ計算時間で競争力があると主張したりはしない。

新しい architecture を作ったところで終わらず、実際に学習して、探索に入れて、既存 model と対局させたことで、次に改善すべきものがかなり具体的になった。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
