---
title: "Splendor AIのarena探索を途中で止めたら1世代23%速くなった"
date: "2026-09-27"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

arenaは新しいmodelを採用してよいか判定する評価フェーズで、当時のCPU loopでは全体の約77%を占めていた。arenaで必要なのは最終的に選ばれるactionだけなので、そのactionが残りsimulationでは覆らないと確定した時点でPUCTを止めるようにした。

self-playではvisit distributionをpolicy targetに使うため、このearly stopは使わない。

## selected actionが確定したら止める

clean PUCTでは、残りsimulationをすべて他候補へ与えても現在の1位を追い越せないなら、最終actionは変わらない。実装ではarenaだけをselected-action searchとして扱い、self-playや固定局面評価は従来どおりfull resultを要求する。

学習target、feature、ONNX interface、seed、self-play artifactは変更していない。

## 1 generationで23.3%短縮

Apple M2、8 workersで、PUCT128 self-play 256 games、512 updates、clean PUCT128 arena 800 pairsの1 generationを比較した。

| stage | baseline | early stop | change |
| --- | ---: | ---: | ---: |
| self-play | 236.5 s | 234.6 s | -0.8% |
| fit | 207.2 s | 205.3 s | -0.9% |
| arena | 1,505.8 s | 1,056.0 s | -29.9% |
| generation total | 1,955.6 s | 1,500.5 s | -23.3% |

arenaのevaluator rowsは11,189,248から約7,748,000へ30.8%減り、process CPU timeも25.4%減った。4 runsのarena aggregateはすべて850-10-740でpromotion判定も同じだった。

early-stop searchからfull visit distributionを読もうとするとerrorにし、途中のdistributionが学習targetへ混ざらないようにした。

## 他の高速化は採用しなかった

| 試したもの | 結果 | 判断 |
| --- | --- | --- |
| ORT memory arena無効化 | 130.3→127.7 s、RSS +38% | 不採用 |
| workerごとにORT session | 260.6→262.7 s、RSS +43% | 不採用 |
| sole-candidate shortcut | 89,378 decisions中3回 | 効果が小さい |
| partition負荷分散 | 254.5〜261.8 s | 長いtailなし |

profileではworker timeの96%がONNX inferenceだったため、search内部を少し速くするより、結果が変わらないleaf evaluationを削る方が効いた。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
