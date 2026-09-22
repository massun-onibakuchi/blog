---
title: "Splendor AIのentity encodingをfactorizeしたが、対局には効かなかった"
date: "2026-09-21"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を使っている。

EAT では、プレイヤー、カード、貴族、bank などを entity として表現し、それぞれを同じ Transformer へ入れて局面を読む。

今回は、この entity を最初に neural network へ埋め込む部分を factorize すると学習しやすくなるかを試した。

結果から書くと、validation loss は少し良くなったが、対局では優位が出なかった。

そのため現在の baseline encoder をそのまま使うことにした。

## 何をfactorizeしたかったか

EAT の entity には、性質の違う情報が同じ row に入っている。

例えば card entity には、

- entity の種類が card であること
- market / reserve / deck のどこにあるか
- tier
- prestige
- bonus color
- cost
- プレイヤーごとの discounted cost

などが入る。

baseline では、これらをまとめて1つの MLP に入れて128次元の entity representation を作る。

これでも Transformer は学習できるが、type や location のような categorical metadata と、cost や prestige のような数値を最初から同じ MLP で処理している。

そこで、意味の違う成分を少し分離してから足し合わせた方が、entity の構造を学びやすいのではないかと考えた。

## 3種類を比較した

比較したのは baseline を含む3種類である。

### B: baseline

62個の入力 feature をそのまま共通の2層 MLP に入れる。

```text
entity features
    |
shared MLP
    |
128-d entity representation
```

### F: factorized

type、role、location、tier の categorical metadata を numeric path から分け、それぞれを learned embedding にする。

残りの49 columns は共通 MLP で処理し、最後に4種類の embedding を加える。

```text
49-column content -> shared MLP
                         +
type embedding
role embedding
location embedding
tier embedding
                         |
                entity representation
```

例えば actor の reserve card なら、

```text
type     = CARD
role     = SELF
location = RESERVE
tier     = T2
```

のように分解される。

重要なのは、入力情報を増やしていないことである。

元の one-hot metadata を別の learned lookup として表現し直しただけで、同じ観測から同じ情報を使っている。

### FT: factorized typed

FT は F に加えて、数値 feature の最初の projection も entity type ごとに分ける。

bank、player、card、noble は持っている feature の意味がかなり違う。

例えば player の token と card の cost を、最初の linear layer から完全に同じ weight で読む必要はない。

そこで、

```text
BANK   -> bank projection
PLAYER -> player projection
CARD   -> card projection
NOBLE  -> noble projection
             |
          GELU
             |
       shared second layer
```

とした。

その後に type / role / location / tier embedding を加える。

モデル全体の parameter 数は、

| encoder | parameters |
| --- | ---: |
| B | 888,324 |
| F | 888,836 |
| FT | 890,116 |

で、FT でも baseline より約0.2%大きいだけである。

つまり「モデルを大きくした実験」というより、同じくらいの capacity で inductive bias を変える実験になる。

## 仮説

期待していたのは、entity の意味を architecture 側で少し整理しておくことで、限られた教師データから有用な representation を学びやすくすることだった。

特に、

- card と player で数値 feature の意味が違う
- SELF / OPPONENT という role は player と reserve card の両方に現れる
- MARKET / RESERVE / DRAW_PILE のような location は独立した semantic factor として扱える

という構造がある。

これらを flat feature として MLP に解釈させるより、最初から factor として与えた方が学習効率が上がる可能性がある。

ただし、これは表現上もっともらしいというだけで、対局が強くなることを保証するものではない。

## 同じ条件で9回学習した

B / F / FT をそれぞれ3 seed、合計9 fits 学習した。

すべて同じ training cache と同じ16-epoch budgetを使っている。

train data は約105万 decision rows、validation は約13万 rowsである。

同じ replicate の B / F / FT では parameter seed と sample order を対応させ、architecture 以外の差をできるだけ小さくした。

validation joint cross entropy の平均は次のようになった。

| encoder | validation joint CE |
| --- | ---: |
| B | 1.39085 |
| F | 1.38168 |
| FT | 1.37606 |

offline metric だけを見ると、

```text
FT < F < B
```

で、structured encoder の方が少し良かった。

特に FT は baseline より約0.0148 nats低い。

しかし replicate ごとに見ると結果は安定していなかった。

1つの seed では明確に良かった一方、別の seed では F / FT の両方が baseline より悪くなった。

baseline 自体の seed 間の幅も約0.0275 natsあり、平均差より大きい。

ここで「FT の方が良い」と決めるには弱い。

## 教師への当てはまりと、良い手を選ぶことは同じではない

この experiment で一番見たかったのはここだった。

validation CE が下がるということは、教師の policy distribution をよりよく再現しているということである。

しかし今回の教師は、ゲームの真の最適 policy ではない。

既存の search / heuristic から作った teacher distribution なので、

```text
teacher をよく模倣する
```

ことと、

```text
実際の対局でより良い手を選ぶ
```

ことは同じではない。

小さい offline loss の差だけで architecture を採用すると、この2つを混同する可能性がある。

そこで最終的には実際に対局させた。

## 対局では差が消えた

EAT は PUCT search と組み合わせて使うため、deployment cost も含めた条件で比較した。

まず同じ128 simulationsで測ると、新しい encoder は少し遅かった。

- F: 約5.3% slower
- FT: 約11.9% slower

そのため、baseline の128 simulationsとほぼ同じ時間になるよう、

- F: 121 simulations
- FT: 114 simulations

に調整した matched-time 条件を事前に決めた。

各 structured encoder を、同じ seed の baseline と256 seat-swapped pairsずつ対局させた結果は、

| encoder | matched-time score vs B |
| --- | ---: |
| F | 0.4958 |
| FT | 0.4661 |

だった。

0.5が互角なので、Fはほぼ互角、FTはむしろ下である。

同じ128 simulationsで比較しても、

| encoder | equal-simulation score vs B |
| --- | ---: |
| F | 0.5049 |
| FT | 0.4808 |

で、明確な優位は出なかった。

raw policy の比較でも同様だった。

offline では FT、F、B の順だったが、その順位は playing strength には移らなかった。

## 何が分かったか

今回の結果から factorized encoding 全般が無意味だとは言えない。

検証したのは、この特定の factorization と、このデータ量・training budgetである。

ただ、少なくとも現在の EAT に対しては、

```text
categorical metadata を factor embedding に分ける
+
entity type ごとに最初の numeric projection を分ける
```

という変更だけでは、採用するほどの playing-strength advantage は確認できなかった。

むしろ重要だったのは、validation CE の小さな改善が、そのまま対局性能の改善を意味しなかったことである。

教師あり bootstrap では offline metric は必要だが、最終的に欲しいものは teacher imitation accuracy ではなく、強い policy-value model である。

architecture の inductive bias を評価するときも、loss が少し下がっただけで結論を出さず、実際の decision quality まで確認する必要がある。

今回は structured encoder を採用せず、baseline を残すことにした。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
