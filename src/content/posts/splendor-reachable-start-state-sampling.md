---
title: "Splendor AIで自己対戦が見ない局面を、モデルなしで生成できるようにした"
date: "2026-09-29"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を作っている。これまで学習や評価に使う局面の多くは、現在のモデル自身が self-play して到達した状態から取っていた。これは自然な分布を得るには便利だが、弱点もある。

現在の policy がほとんど訪れない局面は、学習データにも評価データにも入りにくい。特に、

- 終盤まで長く続いた局面
- 合法手が非常に多い局面
- token を10枚近く抱えた局面
- reserve が多く、候補集合が大きくなった局面

のような状態は、通常の G3 self-play ではかなり少なかった。そこで、ニューラルネットワークを使わずに合法なゲームを進め、欲しい領域に到達した局面だけを start state として保存する sampler を作った。

結果として、G3 self-play では2.2%しかなかった「合法候補100以上」の局面を14.2%まで増やし、ply 64以降の局面も0.23%から7.3%まで増やせた。20,000 trajectory から13,405 statesを作るのに、M2 CPUで26.6秒だった。

## self-playだけに任せると、見ない局面はずっと見ない

強化学習や search self-play では、現在の policy が作る state distribution から次の学習データが作られる。これは on-policy に近い学習には自然だが、現在の policy が避ける状態は次の世代でも観測されにくい。例えば G3 self-play の59,652 decisionsを調べると、候補数の分布は次のようになっていた。

| metric | G3 self-play |
| --- | ---: |
| candidates ≥ 100 | 2.2% |
| candidates ≥ 150 | 0.41% |
| candidates ≥ 200 | 0.049% |
| candidate p90 | 30 |
| candidate p99 | 130 |
| game ply ≥ 64 | 0.23% |
| endgame triggered | 1.1% |
| actor holds 10 tokens | 3.6% |
| actor holds any gold | 7.6% |

通常の対局としてはそれでよくても、モデルや探索器の弱点を調べるには分布が狭い。「候補数が200を超える局面で policy scorer は安定しているか」「終盤の value は正しいか」のような問いを調べたくても、自然発生を待つとサンプルがほとんど集まらない。

## model-free rolloutで局面を作る

新しい sampler は、ニューラルネットワークを一切使わない。通常の初期配置、または既存の supplied state からゲームを開始し、native engine が生成した合法手だけを使って rollout する。seat の behavior には、ニューラルネットワークを使わない手作りの rule-based policy を使う。

- uniform random: 合法手から一様ランダムに選ぶ
- engine-builder teacher: token と development card を積み上げて engine を作る既存の heuristic agent
- point rush: engine の完成度よりも、短い手数で prestige を伸ばして15点到達を急ぐ heuristic agent

つまり、ここでいう teacher や point rush は学習済みモデルの名前ではなく、ルールと手作りの評価関数で行動を選ぶ baseline agent である。さらに trajectory ごとに一定確率で uniform choice を混ぜられる。つまり「強いモデルに局面を作らせる」のではなく、安価な rule policy の組み合わせで state space を広く歩く。

生成物は既存の `sml-start-state-set-v1` と同じ形式なので、self-play、supervised generation、arena のいずれも `supplied_states` としてそのまま使える。専用の学習経路を増やさず、start state だけ差し替えられるようにした。

## 欲しい領域をstratumとして指定する

単に random rollout を大量に回すだけでは、欲しい局面が集まるとは限らない。そこで sampler は、

`leader prestige × effective candidate count`

で stratum を定義する。各 trajectory では最初に狙う stratum を決め、その範囲に入った turn-start state の中から最大1つだけを採用する。1 trajectory から何十 state も取らないのは、同じゲーム内の強く相関した状態で dataset を埋めないためである。

その stratum に一度も到達しなければ、その trajectory からは何も採らない。別の簡単な stratum に置き換えて quota を埋めることもしない。

そのため「何件取れたか」自体が、その領域への到達しやすさの情報になる。

## 分布はかなり変わった

example request では20,000 trajectory を rollout し、13,405 statesを採用した。G3 self-play と比べると、

| metric | G3 self-play | sampled states |
| --- | ---: | ---: |
| candidates ≥ 100 | 2.2% | 14.2% |
| candidates ≥ 150 | 0.41% | 3.9% |
| candidates ≥ 200 | 0.049% | 0.69% |
| candidate p50 | 24 | 32 |
| candidate p90 | 30 | 108 |
| candidate p99 | 130 | 187 |
| game ply ≥ 64 | 0.23% | 7.3% |
| endgame triggered | 1.1% | 7.8% |
| actor holds 10 tokens | 3.6% | 39% |
| actor holds any gold | 7.6% | 28% |

となった。13,405 states はすべて unique で、比較した G3 corpus との exact overlap は0だった。狙っていた「self-play があまり見ないが、ルール上は普通に到達できる状態」をかなり増やせている。

## 生成したstateからそのままゲームを再開できた

局面を作れても、そこから正常にゲームを続行できなければ training restart には使いにくい。そこで sampled starts 1,000件から、G3 の raw policy を両 seat に置いて2,000 gamesを再開した。2,000 gamesすべてが通常の `target_score_equal_turns` で終了し、ply cap timeout は0だった。

start state から終了までの残り plies は、

| percentile | remaining plies |
| --- | ---: |
| p50 | 15 |
| p90 | 48 |
| max | 64 |

だった。full game はおよそ58 pliesなので、同じ evaluator budget でも途中局面から再開すれば、より多くの独立した terminal label を得られる可能性がある。Go-Exploit 的に過去・外部分布の局面から再開するための土台としても使える。

## sampler自体にもdistribution biasはある

この sampler を使えば、自動的に「正しい distribution」が得られるわけではない。behavior の選び方で分布はかなり変わる。teacher 単独では reserve が少なく、元の self-play に近い occupancy になる。

一方、point rush や uniform は reserve を多用するので、候補数の大きい局面を作りやすい。example では teacher : point rush : uniform を 2 : 1 : 1 で混ぜたが、1 seat あたりの reserve 数は平均2.07だった。G3 self-play は0.42なので、sampled distribution は明らかに reserve-heavy である。

これは sampler の欠陥というより、mixture weight を experiment parameter として扱う必要があるということになる。目的は production play の自然分布を再現することではなく、通常の self-play では不足する領域を意図的に補うことである。

## reserve-anchorでさらに候補数の大きい局面を作る

この sampler の直後に、もう1つ model-free policy として reserve anchor を追加した。reserve anchor は、ニューラルネットワークを使わない rule-based agent である。reserve したカードを anchor として保持し、そのカードを買える状態へ近づく action を優先する。既存の teacher や point rush と違う trajectory を安価に作るために追加した。

4,000 trajectory の単独 behavior sampling では、

| behavior | emitted | candidate p90 | candidate p99 | share ≥ 100 |
| --- | ---: | ---: | ---: | ---: |
| point rush | 2,825 | 115 | 195 | 17.0% |
| reserve anchor | 3,008 | 135 | 217 | 24.7% |

となった。leader prestige 5–9 かつ candidates ≥ 100 の state は point rush の115件に対して reserve anchor は229件、prestige 10–14 では39件に対して105件だった。候補集合の大きい中終盤 state を作る behavior としては、かなり効いている。

一方で reserve anchor 単独でも ply 64以降は約1%しかなく、あらゆる rare state を一つの policy で作れるわけではない。必要な領域ごとに stratum と behavior を設計する必要がある。

## 何が変わったか

これまでは、current model が自分で到達する局面を中心に training / evaluation data を作っていた。今回、そこから独立して、

- legal reachability を native engine で保証する
- model inference を使わず安価に rollout する
- 欲しい state region を stratum で指定する
- 1 trajectory から最大1 stateだけ取り相関を抑える
- provenance を残して split hygiene を保つ
- そのまま self-play / supervised / arena の start source に使う

という経路ができた。現在の policy distribution の外側にある局面を、再現可能な artifact として意図的に作れるようになった。今後、終盤の value calibration、rare action の学習、Go-Exploit 型 restart、特定の弱点を狙った評価を行うときに、self-play の自然発生を待たなくてよくなる。

「どの局面を学習・評価できるか」の自由度を増やす基盤ができた。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
