---
title: "Splendor AIのself-playを6世代継続したらG10がG4を+6.2pt上回った"
date: "2026-09-30T10:25:00Z"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を作っている。前回、self-play に使う PUCT の設定を変えたところ、1世代後の G4 network が control より +3.26 points 強くなった。そこで `c_puct=0.75, fpu_reduction=0.0` を採用したが、1世代だけ強くなっても、そのまま self-play を続ければ何世代も伸びるとは限らない。

今回は G4 から recipe を変えず、G5、G6、G7、G8、G9、G10 まで6世代続けた。結果として G10 は G4 との直接対戦で +6.15 points、95% interval [+4.78, +7.53] だった。一方、後半の G8〜G10 が前半の G5〜G7 をさらに上回ったかは解決できなかった。self-play を続けることで G4 より強い network は作れたが、後半の世代でも同じ速度で伸び続けているとまでは言えなかった。

## G4から同じrecipeをそのまま続けた

今回継続したのは、前回の learner-transfer 実験で continuation 用として事前に固定していた3本の G4 network である。training track は 1701、2901、4301 の3本で、各 generation ではひとつ前の network を使って PUCT self-play を行い、そのデータで同じ learner を512 updates進めた。

self-play は G5 から G10 まで一貫して128 simulations、`c_puct=0.75, fpu_reduction=0.0` とした。各 generation では32,768 fresh rowsを保持し、直近2世代の replay と混ぜて学習する。weight だけでなく AdamW の optimizer state も前世代から継続している。

したがって今回測っているのは from-scratch training の性能ではなく、「現在採用している self-play loop を、そのまま何世代か回したときに playing strength がどう動くか」である。

## 世代ごとに同じ物差しへ当てた

generation ごとの強さを比較するため、評価側も途中で変えないようにした。使ったのは frozen strength ladder で、今後の network を毎回同じ opponent、同じ search contract、同じ start schedule に当てるための評価セットである。今回の network はすべて clean PUCT128 の同じ設定で評価した。

主な rung は次の5つである。

- G4@128
- G4 を512 simulationsで探索する challenger
- 固定した network anchor
- point rush
- reserve anchor

point rush と reserve anchor は学習済み model ではなく、異なるプレイ傾向を持つ rule-based agent である。さらに G7 と G10 では fresh roots を使った endpoint evaluation も行い、最終的な arena は144 cells、43,776 gamesになった。

## G10はG4を+6.15 points上回った

primary は G10@128 と G4@128 の直接対戦である。3 tracksを pooled すると次の結果になった。

| comparison | difference | 95% interval |
| --- | ---: | --- |
| G10@128 − G4@128 | +6.15 points | [+4.78, +7.53] |

trackごとの値もすべて正方向だった。

| track | difference |
| --- | ---: |
| 1701 | +4.98 points |
| 2901 | +4.79 points |
| 4301 | +8.69 points |

G4 から6世代続けた結果として、少なくともこの3本の lineage では G10 が元の G4 より強くなっている。直接対戦だけでなく、G8〜G10 の3世代をまとめて G4 と common network rungs 上で比較した差も +6.45 points [+2.70, +10.21] だった。point rush と reserve anchor に対する late block も +1.84 points [+0.49, +3.20] で、G4 との head-to-head だけに現れた差ではなかった。

## ただし後半3世代の追加改善は解決できなかった

事前に、G8〜G10 が G5〜G7 を追加で上回るかを判定する rule も固定した。

そのために common network rungs 上で、

`P = G8〜G10 の平均 − G5〜G7 の平均`

を計算した。結果は +0.61 points [-1.79, +3.006] で、0をまたいでいるため、後半 block が前半 block を上回ったとは確認できない。

一方、今回の plateau 判定では「後半 block の追加 gain が +3 points 未満だと上側から除外できること」を条件にしていた。95% upper bound は +3.006 pointsで、閾値の +3 を約0.006 pointだけ上回った。このため事前に決めた判定では plateau にも入らず、結果は `unresolved` になった。

今回のデータでは、G8〜G10 が G5〜G7 より強くなったとは確認できなかった。ただし、plateau 判定に必要な「95% upper bound が +3 points 未満」という条件も、+3.006 points で満たさなかったため、事前ルール上の判定は unresolved になった。

## point estimateでは早い世代で伸びているように見える

世代ごとの network-rung composite を G4 との差で見ると、次のようになった。

| generation | G4との差 |
| --- | ---: |
| G5 | +3.0 points |
| G6 | +7.1 |
| G7 | +7.5 |
| G8 | +6.9 |
| G9 | +7.2 |
| G10 | +5.2 |

G6あたりで大きく上がり、その後は横ばいに近く見える。fresh endpoint の head-to-head でも、G7 は G4 に +6.6 points、G10 は +6.2 pointsだった。

ただし generation 単体の panel は interval が広く、G10 − G6 の network-rung contrast も -1.9 points [-6.1, +2.4] で解決していない。したがって「G6で伸び切った」とは言えない。今回言えるのは、G4からG10までのどこかで約6 pointsの改善が得られた一方、late block が early block よりさらに改善した evidence は得られなかった、というところまでである。

## 深い探索では差が小さくなった

もうひとつ気になったのが512 simulationsでの比較だった。G7 と G10 は、それぞれ G4 と双方512 simulationsで対戦している。

| model | G4@512との差 |
| --- | ---: |
| G7@512 | +7.5 points [+4.7, +10.4] |
| G10@512 | +2.0 points [-0.9, +4.9] |

G10 の512-simulation margin は0をまたいでいる。ただし G7 と G10 は異なる fresh roots で評価しており、この差自体も事前登録した比較ではないため、「G10はG7より深い探索で弱くなった」とは結論しない。

一方で、128 simulationsで得た改善が、そのまま大きな search budgetでも維持されると仮定する根拠にもならない。次の比較では、候補となる新しい recipe と現在の lineage を深い search budgetでも直接比較する価値がある。

## training側の数字も動き続けていた

playing strength の後半 gain は解決しなかったが、training record 自体は止まっていなかった。G4 から G10 にかけて fresh self-play の visit target entropy はおよそ0.80から0.90 natsへ広がり、training batch の policy cross-entropy は約1.20から1.52へ上がった。一方、value cross-entropy は約0.51から0.45へ下がった。

policy loss の上昇だけを見て fitting が悪化したとは言えない。target distribution 自体が広くなっているためである。ただ、同じ512 updates、同じ learning rate、同じ32,768 fresh rowsという固定 recipe のまま、教師分布と learner の関係が世代をまたいで変わっていることは分かった。これは次に policy/value target の作り方や update budget を直接比較する理由になる。

## plain continuationはいったん延長しない

今回の実験では、結果を見る前に decision rule を固定していた。G10 が G4 より強いだけでは G11〜G13 をさらに回す条件にせず、late block が early block より明確に伸びていることも要求した。

今回はそこが解決しなかったため、判定は `unresolved (not a plateau)` になった。plain continuation は G10 で止め、次は G5〜G10 corpus を使って training recipe を比較する。候補は policy target の作り方、value target、1世代あたりの optimizer updates、data quantity である。今回の6世代継続で、その比較の基準ができた。今の fixed recipe を6世代続けると G4 に対して約6 pointsの gainが得られるので、次は同じデータと計算量を使って recipe を変えたとき、この基準を超えられるかを見る。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
