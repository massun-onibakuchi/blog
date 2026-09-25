---
title: "Splendor AIで補充後に選び直す価値を測ったら、効いていたのはトークン返却だった"
date: "2026-09-25"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

Splendor をプレイする EAT（Entity-Action Transformer）では、1ターンを complete move としてまとめて選んでいる。

ただし表向きカードを取ると、市場が補充されたあとにトークン返却や貴族選択を行う場合がある。cleanup を補充前に決めるより、補充されたカードを見てから決められる方が情報としては有利である。

前回は staged decision がどの程度発生するかを測った。今回はその続きとして、補充後の情報そのものにどれだけ価値があるかを offline で測った。

結果から書くと、補充後に cleanup を選べる価値は1イベントあたり 0.00329 score で、事前に決めていた 0.0025 の基準を超えた。ただし価値の中心は貴族ではなく token return だった。

## 3つのcleanupを比較した

main action を固定し、cleanup だけを3通りにした。

| policy | cleanup |
| --- | --- |
| C | self-play で記録された complete move |
| C+P | refill 前に最良の cleanup を選ぶ |
| C+R | refill 後に refill ごとに最良の cleanup を選ぶ |

C+R − C+P が refill を見ること自体の value of information、VOI になる。C+P − C は refill がなくても cleanup choice を改善するだけで得られる部分である。

## 13,824 gamesを調べた

3 lineages、generation 0〜2 の search self-play data、13,824 games / 805,102 decisions を調べた。

recourse opportunity は1ゲームあたり約2回あったが、実際の policy がその main action を選んだのは約0.2回 / game だった。

| generation | chosen events / game |
| --- | ---: |
| Gen0 | 0.186 |
| Gen1 | 0.225 |
| Gen2 | 0.212 |

機会は存在するが、現在の policy が使う頻度は低い。

## 全refillとcleanupをsearchで評価した

各 event について可能な refill card と cleanup の全組み合わせから successor state を作った。

評価には別 lineage の G3 EAT と clean PUCT-128 を使った。search parameter は c_puct=0.75、fpu_reduction=0.0 である。

同じ successor を独立な2 replicate で評価し、片方で cleanup を選び、もう片方で価値を測る cross-fitting にした。confirmation では chosen events 1,319件をすべて評価した。

## VOIは0.00329だった

事前に1イベントあたり 0.0025 score 以上なら material とする基準を置いた。

| metric | result |
| --- | ---: |
| chosen events | 1,319 |
| cross-fitted PUCT-128 VOI | 0.00329 |
| lower95 | 0.00288 |
| threshold | 0.0025 |

lower bound まで threshold を超えた。

PUCT-512 を256 eventsで追加確認すると、PUCT-512 − PUCT-128 は +0.00021、interval は [-0.00032, +0.00075] だった。今回の範囲では deeper search にすると VOI が消える結果にはならなかった。

## 効いていたのはtoken returnだった

| family | n | mean VOI | bound |
| --- | ---: | ---: | ---: |
| token return | 647 | 0.0054 | lower95 0.0049 |
| noble choice | 672 | 0.0013 | upper95 0.0020 |

reserve 後の token return は threshold を明確に超えた。一方、複数 noble から選ぶ場面は family 全体では threshold 未満だった。

## game全体への効果はまだ小さい

event は約0.2回 / game しか選ばれていないので、現在の occupancy では約0.07 percentage points / game に相当する。stress case の2 events / game なら約0.66 pointsになる。

「情報を見る価値がある」と「今の player 全体が大きく強くなる」は同じではない。

## cleanup自体の改善余地はさらに大きかった

C+P − C は平均 0.0178 / event で、VOI 0.00329 の約5.4倍だった。

refill を見てから選ぶ能力より、cleanup をそもそも上手く選ぶ能力の改善余地の方が大きかった。

staged surface を導入しなくても、atomic policy 側の cleanup evaluation を良くできれば、この部分は取れる可能性がある。

## staged actionを採用したわけではない

今回測ったのは information prize であって staged model の強さではない。

以前に学習した staged arm F0 は atomic baseline より playing score が0.72 points低かった。今回の probe は、その実装・学習コストを測っていない。

また VOI は少数の大きい event に支えられている。median は 0.00006 で、上位1%の14 events が全体の18%を占めた。最大13 eventsを除く sensitivity では lower bound が0.00247となり、threshold 0.0025を少し割った。

分かったのは、refill 後の情報には正の価値があり、主に token return に効くこと、現在の occupancy では game-level effect は小さいこと、さらに cleanup policy 自体の改善余地の方が大きいことだった。

次は selective staging、atomic policy の cleanup 改善、post-refill override のどれが finished player の強さにつながるかを比較したい。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが編集し、筆者が内容を確認・修正しています。
