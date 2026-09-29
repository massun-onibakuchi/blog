---
title: "Splendor AIでPUCTの探索設定をself-playへ移したらG4が+3.26pt改善した"
date: "2026-09-29"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を作っている。

前回は、探索 self-play を3世代進めた generation 3、G3 の network を固定し、PUCT の探索パラメータだけを変える実験をした。

その結果、128 simulations では従来の

`c_puct=1.5, fpu_reduction=0.25`

より、

`c_puct=0.75, fpu_reduction=0.0`

の方が +8.55 points 良かった。

ただし、その時点では self-play の設定は変えなかった。

理由は、対局時の探索が強くなることと、その探索が作った visit distribution を教師として学習した次世代 network が強くなることは別問題だからである。

今回は、その効果が学習後の network に転移するかを直接調べた。

結果として、改善した探索設定で self-play して学習した G4 は、従来設定で self-play した G4 より primary endpoint で +3.26 points 良かった。

95% interval は fixed networks で [+2.06, +4.45] points、training replicate variation を反映した level でも [+1.40, +5.12] pointsだった。

この結果を受けて、G5 以降の self-play では `c_puct=0.75, fpu_reduction=0.0` を使うことにした。

## 探索が強くても、学習後のnetworkが強いとは限らない

PUCT は、network の policy prior と探索中に得た value を組み合わせて、次にどの手を探索するか決める。

`c_puct` は prior による exploration bonus の強さを調整する。

`fpu_reduction` は、まだ一度も探索していない候補の初期 value をどれだけ低く置くかを決める。

前回の実験では、同じ G3 network に対してこの2つを変えるだけで、128 simulations の対局性能が改善した。

しかし self-play では、探索は単に対局を行うだけではない。

各局面で得られた visit distribution が policy target になり、その trajectory と target を使って次の network を学習する。

そのため、探索パラメータを変えると、

- どの局面を訪れるか
- 各局面でどの action に何 visit 集まるか
- policy target の sharpness
- 次世代 network が学ぶ state-action distribution

まで変わる。

評価時の探索で良かった parameter を、そのまま training data generator に使っても改善するとは限らない。

## G3から1世代だけ進めてA/Bした

実験では、G3 の3つの training track、1701、2901、4301をそれぞれ1世代だけ継続した。

比較した arm は2つである。

| arm | `c_puct` | `fpu_reduction` |
| --- | ---: | ---: |
| control | 1.5 | 0.25 |
| treatment | 0.75 | 0.0 |

どちらも PUCT 128 simulations で、root noise、temperature、tree reuse、game cap など他の self-play 条件は同じにした。

各 track × arm について collection replicate を3つ作ったので、最終的には18個の G4 network を学習した。

各 network は32,768 rowsの新しい self-play dataを保持し、G2/G3 replay と混ぜながら512 optimizer updates進めた。

初期 weight だけでなく optimizer state と update counter も G3 から継続している。

つまり今回は from-scratch training の比較ではない。

「今の G3 loop が次の1世代を作るとき、どちらの self-play setting を使うべきか」という運用上の問いに合わせている。

## 評価時の探索は両armで同じにした

学習後の18 network は、すべて同じ clean PUCT 128 で評価した。

evaluation setting は、

`c_puct=0.75, fpu_reduction=0.0`

に統一した。

相手は5種類である。

- G3-1701
- G3-2901
- G3-4301
- point rush
- reserve anchor

前半3つを league half、後半2つを rule half とし、primary endpoint では両方を50%ずつ重み付けした。

opponent の数が3対2なので、単純平均にすると league 側が自動的に重くなる。それを避けるためである。

panel 全体では23,040 gamesを行った。

さらに同じ parent / replicate の treatment G4 と control G4 を直接対戦させる head-to-head も4,608 games行った。

## primaryは+3.26 pointsだった

結果は次の通りだった。

| endpoint | treatment - control | fixed networks 95% | replicate level 95% |
| --- | ---: | --- | --- |
| equal-halves composite | +3.26 points | [+2.06, +4.45] | [+1.40, +5.12] |
| league half | +5.30 | [+3.59, +7.02] | [+2.16, +8.44] |
| rule half | +1.22 | [-0.17, +2.60] | [-1.57, +4.00] |
| head-to-head | +4.25 | [+2.89, +5.61] | [+2.04, +6.46] |

primary endpoint は fixed-network level と replicate level の両方で interval 下限が0を上回った。

3つの parent track ごとの平均差も、

| track | treatment - control |
| --- | ---: |
| 1701 | +4.53 points |
| 2901 | +2.25 points |
| 4301 | +3.00 points |

ですべて正だった。

9つの track × replicate unit のうち8つは正で、1つだけ -0.16 point とほぼ差なしだった。

少なくとも今回の3つの G3 lineage では、特定の1 seedだけが大きく勝って平均を押し上げた結果ではなかった。

## 改善はleague側から来ていた

一方で、結果を「全部の相手に強くなった」と解釈すると間違う。

league half は +5.30 pointsで、fixed-network interval も replicate-level interval も0より上だった。

しかし rule half は +1.22 pointsで、fixed-network 95% interval が [-0.17, +2.60]、replicate level が [-1.57, +4.00] だった。

つまり point rush と reserve anchor に対して良くなったとは確認できていない。

今回の事前ルールでは、primary が改善し、league / rule のどちらかが -2 points より悪化している証拠がなければ採用できる設計だった。

rule half はその安全 margin 内には入っていたが、改善を示したわけではない。

今回の +3.26 points は league-driven な改善として扱う必要がある。

## 前回見つけた終盤threatの弱点も残っていた

直前の分析では、G3 が rule opponent の終盤で、相手が reserve に即勝ちカードを持つ状態を楽観的に評価する傾向が見つかっていた。

今回、その同じ165 threat turnsに対して G4 の raw value も確認した。

勝率の実測は0.388だったのに対し、

| model | raw valueが見積もる勝率 |
| --- | ---: |
| G3 | 0.625 |
| control G4 mean | 0.681 |
| treatment G4 mean | 0.664 |

だった。

treatment がこの問題を解消したとは言えない。

一方で self-play 中に自然に現れた類似 threat state では、raw value の誤差はだいたい +0.02 から +0.08に収まっていた。

rule opponent が作る threat state では、小さい engine のまま reserve した勝ち札を抱える形が多く、self-play で出る threat state とは分布がかなり違っている。

そのため、今回の A/B で探索パラメータを変えただけでは、この value error が直らなかったという解釈が一番整合的だった。

self-play setting の改善と、training distribution coverage の問題は分けて扱う必要がある。

## treatmentのpolicy targetはむしろ広くなった

training record も確認した。

treatment の visit target entropy は0.805 nats、control は0.723 natsだった。

つまり `c_puct=0.75, fpu_reduction=0.0` の方が、今回の self-play では target distribution が少し広かった。

policy cross-entropy は treatment 1.195、control 1.023だった。

ただし cross-entropy には target 自体の entropy も含まれる。

target が広くなれば、完全に同じ fitting qualityでも cross-entropy は上がり得る。

そのため、この差だけを見て treatment の policy fitting が悪化したとは判断できない。

今回重要なのは、offline loss の大小ではなく、その target で学習した network が実際の arena でどうなったかだった。

## G5以降のself-play設定を変更した

今回の decision rule では adoption 条件を満たした。

そのため G5 以降の lineage は、

`sml-puct-v4, 128 simulations, c_puct=0.75, fpu_reduction=0.0`

で self-play data を集める。

continuation network は各 track の treatment replicate 0 を使う。

これは結果を見て9 siblingの中から一番強いものを選んだわけではない。

replicate 0 は実験前から通常 loop の continuation として指定していたものなので、そのまま lineage を進める。

## 今回分かったこと

前回は、「同じ G3 network でも PUCT parameter を変えると探索強度がかなり変わる」と分かった。

今回はその次の段階として、「改善した探索から作った self-play data で学習すると、1世代後の network も強くなる」ことを確認できた。

ただし、分かった範囲はかなり限定される。

- G3からG4への1 generationの効果転移
- 3つの既存 training track
- self-play は128 simulations
- evaluation も `c_puct=0.75, fpu_reduction=0.0` の PUCT 128
- improvement は主に league opponent に対して出た
- rule opponent の threat-state value error は残った

この実験だけから、複数世代回したときも同じ差が続く、from-scratch でも有利、別 simulation budget でも有利、あるいは `0.75 / 0.0` が最適値だとは言えない。

それでも、探索設定の調整を evaluation-time の小技で終わらせず、learning loop の data generation 側まで移せることを1世代の A/B で確認できた。

次の generation からは、この setting を通常の self-play loop として使う。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
