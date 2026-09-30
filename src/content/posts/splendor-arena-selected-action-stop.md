---
title: "Splendor AIのarena探索を途中で止めたら1世代23%速くなった"
date: "2026-09-27"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

Splendor の機械学習プレイヤーを開発している。現在の学習ループでは、self-play でデータを作り、そのデータでモデルを更新し、最後に新しいモデルと現行モデルを arena で比較する。arena は新しいモデルを採用してよいか判定する評価フェーズである。最近このループの CPU 実行時間を測ったところ、arena が全体の約77%を占めていた。

そこで今回は、arena の PUCT 探索を最後まで回さず、選択される action がもう変わらないと分かった時点で止めるようにした。結果は arena が29.9%短縮され、self-play から評価まで含む1世代全体では23.3%短縮された。arena の aggregate と promotion 判定は変わらなかった。

## arenaでは探索結果の全部を使っていなかった

現在のモデルは EAT（Entity-Action Transformer）という neural network で、局面と合法手から prior と value を出し、PUCT で action を決める。self-play では root visit の分布を policy target に使うので、128 simulations と決めたら最後まで探索する必要がある。

一方、arena で必要なのは最終的に選ばれた action だけである。arena は temperature 0 の clean PUCT なので、途中まで探索した時点で「残りの simulation を全部ほかの候補に与えても現在の1位を追い越せない」と分かったなら、それ以降の探索は結果を変えない。従来はその場合でも128 simulationsを最後まで実行していた。

## 選択が確定したら止める

実装では arena だけを selected-action 用の search として扱い、self-play や固定局面評価は従来どおり full result を要求するように分けた。そのため early stop が入るのは clean PUCT の arena だけである。root noise を使う self-play、opening temperature、tree reuse、Gumbel search などは従来どおり budget を最後まで使う。学習 target、特徴量、ONNX interface、seed、self-play artifact の形式も変更していない。

1位に visit が集中する局面ではかなり早く止められる。実測では、最終的に128 visitsが1 actionに集まる局面で simulation 65 までで選択が確定した。一方、63対40のような接戦では最後近くまで探索する。固定割合で budget を削るのではなく、その root で選択が変わらないと判定できた分だけ省く。

## 実際のself-play loopで測った

Apple M2、8 workers で、実際の1 generation を2回ずつ interleave して比較した。1 generation は PUCT128 self-play 256 games、512 optimizer updates、clean PUCT128 arena 800 pairs で構成している。

| stage | baseline mean | early-stop mean | change |
| --- | ---: | ---: | ---: |
| self-play | 236.5 s | 234.6 s | -0.8% |
| fit | 207.2 s | 205.3 s | -0.9% |
| arena | 1505.8 s | 1056.0 s | -29.9% |
| generation total | 1955.6 s | 1500.5 s | -23.3% |

arena で neural network に評価させた candidate rows は 11,189,248 から約7,748,000へ30.8%減った。process CPU time も 11,989秒から8,940秒へ25.4%減った。

## 評価結果は変わらなかった

4 runs の arena aggregate はすべて 850-10-740 で、promotion 判定も同じだった。arena 単体の probe でも、64 pairs は baseline / early stop とも 60-0-68、200 pairs はともに 214-0-186 だった。test では consecutive decisions を含めて full-budget search と同じ action を選ぶことを確認している。

また、early-stop した search から full result を読もうとするとエラーにした。途中で止めた visit distribution を誤って学習 target として使えないようにしている。

## 効かなかった高速化

profile では ONNX Runtime の allocator mutex で inference sample の約7%が待っていた。memory arena を無効化すると64 pairsは130.3秒から127.7秒になったが、RSS は38%増えた。worker ごとに ONNX session を分ける方法は200 pairsが260.6秒から262.7秒になり、RSS は43%増えた。どちらも採用しなかった。worker の負荷分散も調べたが、200 pairs の8 partitionsは254.5〜261.8秒で終了しており、長い tail はなかった。

合法手が1つだけなら neural network を呼ばない shortcut も調べたが、G3 self-play の89,378 decisionsで該当したのは3回だけだった。

## early stopで不要なnetwork evaluationを削減した

arena の profile では worker time の96%が EAT の ONNX inference に入っていた。tree search や candidate generation 自体は約4%しかない。そのため search の内部処理を少し速くするより、もう結果が変わらない search に対して neural network を呼び続けない方が大きく効いた。

今回の変更では search algorithm を近似していない。model architecture や training data も変えていない。現在の CPU loop では1 generation が約32.6分から25.0分まで短くなった。計測は Apple M2 CPU 上だけで、GPU arena の wall time はまだ測っていない。ただし selected action が確定した後の evaluator rows 自体が消えるので、CUDA でも search が要求する rows は同じ割合で減る。wall time の改善率は別途測る必要がある。

モデルの評価指標を直接改善する変更ではないが、同じ計算資源でより多くの self-play generation と評価を回せるようになる。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
