---
title: "Splendor AIで「補充を見てから返す」価値を測った"
date: "2026-09-26"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

Splendor をプレイする EAT（Entity-Action Transformer）では、1ターンをどの単位で policy に選ばせるかを検討している。

特に気になっていたのが、表向きカードを取ったあとに市場へ新しいカードが補充され、そのカードを見てから token return や noble choice を選べることだった。

従来の atomic policy は、main action と cleanup をまとめて先に選ぶ。

一方、staged policy なら refill 後に cleanup を選べる。

前回の Stage 0 では、この違いが発生する局面自体がかなり疎いことが分かった。

では、疎くても1回あたりの価値が大きいなら、staging を持つ意味はあるのか。

今回はそこだけを offline で測った。

結果から書くと、補充後に cleanup を選び直せる情報価値は、事前に決めた基準では material だった。

ただし、その価値の大半は token return から来ており、noble choice の価値は小さかった。

## 何を測りたいのか

例えば表向きカードを reserve して token が10枚を超えると、最後に1枚返す必要がある。

市場の空いた slot には先に新しいカードが補充されるため、正式なゲーム順序ではその refill を見てから返す色を決められる。

同じことが、購入後に複数の noble を取れる場合にも起こる。

このとき比較したいのは3つである。

- C: generator が実際に選んだ complete move
- C+P: refill を見る前に、最善の cleanup を選ぶ
- C+R: refill を見たあとで、最善の cleanup を選ぶ

$\mathrm{C{+}R}-\mathrm{C{+}P}$ が純粋な「新しい情報を見る価値」になる。

$\mathrm{C{+}P}-\mathrm{C}$ は、refill がなくても cleanup の選び方を改善するだけで得られる価値である。

この2つを分けるのが今回のポイントだった。

## refillごとの未来を全部評価する

recourse event が起きた局面について、

1. 起こり得る refill card
2. 選べる cleanup

の組み合わせを全部作り、その successor state を評価した。

cleanup を $b$、refill card を $z$ とすると、情報価値は次になる。

$$\operatorname{VOI}=\mathbb{E}_{z}\!\left[\max_b Q(z,b)\right]-\max_b\mathbb{E}_{z}\!\left[Q(z,b)\right]$$

左側は refill を見てから cleanup を選ぶ場合。

右側は refill を見る前に1つの cleanup に commit する場合である。

評価には別 lineage の G3 network を使い、clean PUCT-128 で successor を読む。

さらに同じ値で選択と評価をすると maximization bias が乗るため、独立な2回の search を使って cross-fitting した。

片方で cleanup を選び、もう片方で値を測る。方向を入れ替えて平均する。

これで「ノイズの大きい候補をたまたま選んだだけ」の上振れを減らしている。

## まず、どのくらい起きるのか

Gen0〜Gen2 の self-play corpus 13,824 games、805,102 decisions を調べた。

refill 後に複数 cleanup が残る opportunity 自体は、平均すると1ゲームあたり約2回あった。

しかし実際の generator がその main action を選んだ chosen event は約0.2回 / game だった。

つまり自然な trajectory 上では、5ゲームに1回程度である。

rare event ではあるが、ゼロに近いわけでもない。

## 1回あたりの情報価値は基準を超えた

confirmation では 1,319 chosen events を評価した。

事前に決めていた per-event threshold は 0.0025 score だった。

score は win=1、draw=0.5、loss=0 なので、0.0025 は0.25 percentage point に相当する。

結果は次のようになった。

| quantity | value |
| --- | ---: |
| post-refill recourse VOI | 0.00329 |
| one-sided 95% lower bound | 0.00288 |
| frozen threshold | 0.00250 |

lower bound が threshold を超えたため、事前ルールでは material になった。

1 event あたりでは約0.33 percentage point の期待 score 差である。

## 効いていたのはtoken returnだった

event を種類ごとに分けると差がはっきりした。

| family | n | mean VOI | one-sided 95% bound |
| --- | ---: | ---: | ---: |
| token return | 647 | 0.0054 | lower 0.0049 |
| noble choice | 672 | 0.0013 | upper 0.0020 |

token return は threshold の約2倍だった。

一方、noble choice は upper bound まで含めて threshold を下回った。

つまり今回観測した post-refill information の価値は、主に reserve-at-ten でどの token を返すかから来ている。

「複数 noble を見て refill に応じて選び分ける」ことは、少なくともこの evaluator と corpus では大きな項ではなかった。

## 512 simulationsに増やしてもほぼ変わらなかった

PUCT-128 の評価が弱すぎて情報価値を歪めている可能性もある。

そこで256 eventsについて PUCT-512 でも同じ評価を行った。

PUCT-512 − PUCT-128 の VOI 差は +0.00021、区間は [-0.00032, +0.00075] だった。

少なくともこの ladder では、search を4倍にしても値はほぼ変わらなかった。

もちろん、G3 evaluator 自体に共通の blind spot があれば両方とも同じ方向へ間違う。

そのため「真の optimal value を測れた」という意味ではない。

## 1ゲーム全体ではまだ小さい

1 event あたりの値は threshold を超えたが、event 自体は rare である。

実測 occupancy を $\lambda$、1 event あたりの情報価値を $\mu$ とすると、game-level prize は

$$\operatorname{prize}=\lambda\mu$$

と書ける。実測の $\lambda \approx 0.2$ と $\mu \approx 0.00329$ を掛けると、全体の prize は約0.0007 score / game、つまり約0.07 percentage point / game になる。

実験の frozen rule では stress case として 2 events / game も見ており、その場合は約0.66 percentage point / game になる。

ここはかなり重要で、

「per-event value が material」であることと、「finished player が大きく強くなる」ことは同じではない。

## むしろcleanupそのものを上手く選ぶ価値の方が大きかった

もう1つ面白かったのが $\mathrm{C{+}P}-\mathrm{C}$ だった。

refill を見なくても、generator が選んだ cleanup より良い cleanup を選ぶだけで得られる correction は平均 0.0178 score / event だった。

これは post-refill information value の約5.4倍である。

つまり今回の局面では、

「refill を見られること」よりも、「cleanup choice 自体をもっと正確に選ぶこと」の方が大きな改善余地だった。

staged representation を採用するかどうかとは別に、RETURN の policy quality を上げる価値があることが分かった。

## 平均値は少数の大きなeventに支えられている

material という結果には注意点もある。

median event の VOI は 0.00006 とかなり小さい。

上位1%の14 eventsだけで、全 VOI の18%を占めていた。

最大13 eventsを除くと lower bound は 0.00247 まで下がり、frozen threshold をわずかに割る。

つまり「多くの局面で少しずつ効く」というより、一部の局面で大きく効く tail-heavy な効果だった。

最大 event では VOI が約0.217あり、PUCT-128 と PUCT-512 の両方で大きかった。

独立な LLM audit でもその局面では refill に応じて noble を選び分ける判断が再現されたが、Splendor expert による blind audit はまだ行っていない。

そのため tail の正しさは未確認として残している。

## staged actionを採用する結論ではない

今回分かったのは、post-refill recourse の情報価値の符号と大きさである。

staged action surface の方が atomic surface より強い、という比較ではない。

以前の learned staged arm では、atomic baseline に対して別の学習上の loss も観測されている。

staging で情報を増やしても、その representation が学習しづらければ finished player は弱くなり得る。

逆に atomic policy を維持したまま、必要な局面だけ post-refill cleanup を上書きする設計も考えられる。

今回の実験は、その設計判断に必要だった「情報を後から見ること自体に価値があるか」を切り出して測ったものになる。

結論としては、価値はある。

ただし主に token return にあり、自然な occupancy ではゲーム全体への寄与は小さい。そして cleanup policy 自体を良くする余地の方がさらに大きい。

次に action contract を選ぶときは、この information prize と、staged representation の学習コストを別々に扱う必要がある。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
