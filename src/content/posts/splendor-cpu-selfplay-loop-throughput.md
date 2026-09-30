---
title: "Splendor AIのCPU学習ループを高速化したら、実ループで16.6%短縮できた"
date: "2026-09-29"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "performance"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を作っている。現在は、モデルに自己対戦させ、その探索結果を教師として次のモデルを学習し、arena で評価する、というループを回している。このループはモデルの強さを上げる中心部分だが、CPU で回すと時間の大半を探索中のニューラルネットワーク推論が占めていた。

そこで、探索や学習の意味を変えずに、CPU 実行だけを速くする最適化を進めた。最初の計測では1世代あたり25.2%短縮できた。

ただし、この数字は self-play、training、arena を個別に計測して合成したものだった。その翌日に実際の product loop を最初から最後まで走らせて測り直すと、改善は16.6%だった。20%短縮という目標には届かなかったが、1世代は平均1,866秒から1,556秒まで短くなった。

今回は、この高速化で何が効いたのかと、何が効かなかったのかを書く。

## まず、CPU時間の97%以上がONNX Runtimeだった

最初に profiler を当てると、self-play 中の worker CPU時間の97%以上が ONNX Runtime の推論に入っていた。候補生成やゲーム状態の更新、探索木そのものの処理は2%未満だった。profiler 上では、探索コードより次の evaluator workload を減らす余地が大きかった。

- ONNX Runtime に何行渡すか
- どれだけ padding を計算させるか
- 同じ状態を何度評価するか
- CPU core に何本の worker を置くか

を改善する方が効く状態だった。この時点で、ボトルネックはかなり明確になった。

## logical CPUの数だけworkerを立てると遅かった

使っていた GCE の c3d-standard-16 は、8 physical cores / 16 threads の SMT 構成だった。従来の既定値は os.cpu_count() を使っていたため、16 worker が立っていた。

しかし ONNX Runtime を single-thread caller として並列実行した場合、

| worker数 | 推論 throughput |
| --- | ---: |
| 8 | 約7,600 rows/s |
| 16 | 約5,400 rows/s |

となった。SMT sibling 同士が同じ core の演算資源を取り合い、worker を倍にした方が遅くなっていた。

そこで既定値を logical CPU 数ではなく、affinity mask 内の physical core 数に合わせた。この host では16 workerから8 workerになる。小さいニューラルネットワークだから thread を増やせば増やすほど速くなる、というわけではなかった。

## 同じ状態をもう一度networkに通さない

探索中には、以前評価した public state に再び到達することがある。従来はそのたびに network evaluator へ送り直していた。

そこで worker ごとに、完全に同じ public state の policy logits と value を記録する evaluation memo を追加した。これは探索木の再利用ではない。新しい node の visit count や Q は毎回ゼロから始めるが、network の forward 結果だけを再利用する。

これで evaluator に送る row 数は、

- self-play で8.1%減少
- arena で2.8%減少

した。evaluation memo は search node の visit count や Q を共有せず、network forward の結果だけを再利用する。

## paddingの少ないbatchに分け直した

EAT の policy head は、局面によって合法手の数が違う。そのため複数局面を同じ ONNX call にまとめると、候補数の少ない局面を最大幅まで padding する必要がある。従来は、1 call の総 cell 数が一定以下になるように greedy に batch を作っていた。

しかし候補数が大きく違う row を同じ batch に入れると、padding が急増する。CPU上で実測すると、1回の ONNX call の固定費は約36 padding cells分だった。

そこで、 calls × call_cost + padded_cells が最小になるように dynamic programming で batch を分割するようにした。

結果として padded / actual candidate cells は、

| workload | before | after |
| --- | ---: | ---: |
| self-play | 1.68 | 1.08 |
| arena | 2.22 | 1.11 |

まで減った。この workload では、batch を大きくすることより padding ratio の削減が throughput に効いた。

## GELUを1 nodeで出力する

EAT の export は当初 ONNX opset 18 を使っていた。この graph では GELU が Div、Erf、Add、Mul、Mul という複数 node に展開されていた。ONNX Runtime 1.26 はこの形を1つに fuse していなかった。

opset 20 では GELU を直接 Gelu node として出力できる。同じ weight、同じ関数のまま export だけを変えると、1 row あたりの推論時間は 0.937 ms から 0.899 ms となり、4.1%短縮した。モデル構造を変えなくても、export 後の計算 graph がどうなっているかを見る価値がある。

## 最初の計測では25.2%短縮した

ここまでの4変更を入れて、self-play、training、arena を個別に計測した。結果は、

| stage | before | after | change |
| --- | ---: | ---: | ---: |
| self-play, 256 games | 305.6 s | 183.4 s | -40.0% |
| arena, 800 games | 834.6 s | 602.6 s | -27.8% |
| 合成した1 generation | 2,329.9 s | 1,743.8 s | -25.2% |

だった。目標にしていた20%短縮を超えている。

ただし、ここには問題があった。training は実際の loop が使う full training path ではなく、別の update path の timing を512回分へ外挿していた。

また各 stage を別々に測って合成している。そのため、次に実際の run_self_play_loop を1世代そのまま走らせて確認した。

## 実ループでは16.6%だった

follow-up では、前の最適化を baseline とし、その上で ONNX と training の無駄をさらに削った。follow-up では、ONNX graph 内の未使用 entity / candidate row を packed representation から除外した。G3 の self-play では、dense tensor に用意している entity slot のうち約29%、state row の約21%が実際には存在しない row だった。

以前はそれらも row-wise layer を通していた。packed entry では mask から存在する row だけを選び、training と同じ packed computation を使う。Genoa CPU での推論 throughput は、約8,100 rows/s から約11,800 rows/s まで上がった。

さらに、

- value readout の重複 projection を削減
- candidate が参照する state row の projection を候補ごとではなく局面ごとに共有
- training の policy attention を decision ごとに16 query幅へ分割
- packed graph 用に evaluator batch cost を再校正
- search edge の state を heap に置き、edge size を224 bytesから56 bytesへ削減

した。

## real product loopの結果

同じ GCE c3d-standard-16 Spot VM で、実際の1 generationを end-to-end で計測した。self-play は256 games、training は512 updates、arena は800 pairsである。

| stage | baseline mean | treatment mean | change |
| --- | ---: | ---: | ---: |
| self-play | 196.0 s | 164.4 s | -16.1% |
| training | 375.7 s | 325.1 s | -13.5% |
| arena | 1,285.5 s | 1,053.7 s | -18.0% |
| generation total | 1,866.3 s | 1,555.6 s | -16.6% |

最初の25.2%という数字より小さい。しかしこちらは、実際に production で使う loop 全体を走らせた結果である。

そのため現在は、CPU loop の実測改善として16.6%を見るのが適切だと考えている。20%という事前目標には届かなかった。

## arenaがまだ一番重い

baseline の real loop を分解すると、

- self-play: 約196秒
- cache preparation: 約4秒
- training: 約376秒
- export: 約5秒
- arena: 約1,285秒

だった。1 generation の約69%が arena である。self-play と training をかなり速くしても、arena が大きいため loop 全体の改善率はそこで制限される。

baseline では arena が generation wall time の約69%を占めたため、end-to-end の改善率は arena の短縮に強く制約される。

## 速かったが採用しなかった方法もある

さらに大きな高速化候補も試した。

### INT8 inference

dynamic INT8 quantization では、8,139 rows/s から13,286 rows/s と約64% throughput が上がった。しかし policy の top-1 agreement は94.8%だった。policy logit error も最大2.2あり、探索のほぼ全 decision に影響する。

これは execution optimization ではなく evaluator 自体を変える変更になるので、今回の高速化としては採用しなかった。

### bf16 mixed CPU training

CPU training を bf16 mixed precision にすると、1 update は約19%速くなった。ただし、これも training recipe が変わる。モデル品質への影響を別実験で確認せずに、単なる高速化として採用することはできない。

### arena concurrencyを増やす

1 worker あたりの arena concurrency を32から128へ増やすと、逆に約19%遅くなった。大きな batch が常に速いわけではない。tree、memo、ORT activation の working set が増え、CPU側では悪化した可能性が高い。

そのため product default は32のままにした。

## 計算するrow数を減らす変更が効いた

888k parameter 程度の EAT を CPU search で使う今回の workload では、throughput 改善は batch / thread 数の増加より、実際に計算する row 数の削減から得られた。特に効いたのは、

- SMT threadではなく physical core ごとに worker を置く
- 同じ state の network evaluation を再計算しない
- padding の多い row を無理に同じ batch に入れない
- export graph で不要な演算を残さない
- dense slot 全体ではなく存在する row だけを処理する

という変更だった。stage-level extrapolation は25.2%だったが、end-to-end loop の再計測では16.6%だった。高速化では microbenchmark が良くても、最終的に使う workflow 全体で同じ改善率になるとは限らない。

今回の変更は playing strength を直接上げるものではない。ただし、同じ CPU 時間で self-play、training、arena の iteration をより多く回せるようになる。モデル改善の experiment loop 自体を短くするという意味で、今後の試行回数と検証速度に直接効く進捗になった。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
