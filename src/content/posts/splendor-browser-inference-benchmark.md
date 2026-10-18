---
title: "ブラウザのSplendor AIではWebGPUよりCPUが約8倍速かった"
date: "2026-10-18T10:30:00+09:00"
isPublished: true
lang: ja
tags: ["splendor", "web", "performance"]
---

Splendor AIをブラウザだけで動かすため、ONNX Runtime Webを使った推論経路の速度を測った。候補はCPU側のWASM実行とWebGPUだった。

一般にはGPUの方が速いと期待しやすいが、今回のSplendorモデルと探索ワークロードでは逆だった。CPU実行は約733 simulations/s、WebGPUは約88 simulations/sで、CPUの方が約8.3倍速かった。

この結果は「WebGPUが遅い」という一般論ではない。小さなnetworkを多数回呼ぶ現在の探索構成では、GPUへ仕事を渡す固定費が支配的になっている可能性が高い。

## 同じモデルをブラウザで比較した

測定対象は、ブラウザ上でU系モデルを使ってPUCT探索する実装である。

同じnetwork、同じ局面、同じ探索条件で、ONNX Runtime Webのexecution providerだけを切り替えた。

| backend | 探索速度 |
| --- | ---: |
| WASM / CPU | 約733 sims/s |
| WebGPU | 約88 sims/s |

WebGPUはCPUの約12%の速度だった。

現在のnetworkは比較的小さく、1回の推論batchも大きくない。そのため、GPUの演算性能を使い切る前にdispatchや同期、buffer transferなどの固定費を何度も払っていると考えられる。

## 小さいnetworkではGPUを使うだけでは速くならない

GPU推論が有利になるのは、一般に演算量が十分大きい場合や、多数の入力をまとめてbatch処理できる場合である。

一方、MCTS/PUCTでは探索木を辿った結果として必要なleaf評価が逐次的に発生する。今回のブラウザ実装でも、GPUへ大きなbatchを継続的に流せる構造にはまだなっていない。

そのため、

1. 木をCPUで辿る
2. 小さな推論要求をGPUへ送る
3. 結果を待つ
4. 木を更新する

という往復のコストが、network本体の演算より大きくなっている可能性がある。

今回の測定では、単純にexecution providerをWebGPUへ変えるだけでは高速化にならなかった。

## 探索木のメモリは約10.8 KiB/visit増えた

ブラウザ実行では速度だけでなくメモリも重要になる。デスクトップ用のnative playerと違い、一般ユーザーのブラウザ上で長時間探索しても安定して動く必要がある。

今回の測定では、探索木によるメモリ増加はおよそ10.8 KiB/visitだった。

単純計算では、

| visits | 推定追加メモリ |
| ---: | ---: |
| 128 | 約1.4 MiB |
| 1,024 | 約10.8 MiB |
| 10,000 | 約105 MiB |

程度になる。

実際のbrowser process全体のメモリはruntimeやmodel buffersなども含むため、この表はtree部分の増分を見るための目安である。

128 simulations程度なら問題になりにくいが、将来探索budgetを数千〜数万へ増やす場合は、tree reuseやnode表現、cache設計もブラウザ向けの制約になる。

## 推論精度も確認した

速度だけ速くても、browser backendで出力が変われば対局モデルとしては使えない。

そのためnative側とbrowser側の推論出力も比較した。今回の測定範囲では、実用上問題になる差は確認されなかった。

一方で、backendやbrowser、GPU driverによる数値差は今後もありうる。特にsearchでは小さなlogit/value差がvisit配分へ増幅される場合があるため、単発のtensor誤差だけでなく、同じ局面で最終着手やroot statisticsがどこまで一致するかを見る必要がある。

## 今回の結果から次に変えるべきもの

現在のブラウザ版では、WebGPU化そのものよりbatch inferenceの方が重要そうだ。

networkを1回ずつGPUへ投げる構造のままでは、今回のようにCPUより遅くなる。複数ゲームや複数leafをまとめて評価できれば、GPUの固定費をbatch全体へ分散できる。

候補としては、

- 複数の探索leafをまとめるbatched inference
- 複数対局を同時に探索するroot parallelism
- worker間で共有するinference queue
- network自体を大きくした場合のCPU/WebGPU再測定

などがある。

現時点のモデルでブラウザ対局を動かすだけなら、CPU/WASMを使う方が単純で速い。

GPUという名前だけで高速化を期待せず、実際のnetwork sizeと探索側のrequest patternを含めて測る必要がある、というのが今回のベンチマークで得られた一番大きな知見だった。

---

この記事は、実装・実験記録をもとに、主にLLMが編集しています。
