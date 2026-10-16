---
title: "ブラウザ上で動くSplendorのAI対戦環境を作った"
date: "2026-10-16T12:00:00+09:00"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "onnx", "webassembly"]
---

学習させたモデルとブラウザ上で対戦できる環境（[sml-web](https://sml-web.bakuchi.workers.dev/)）を作った。

ONNX Runtime WebとWebAssemblyを使い、盤面の探索からモデル推論までブラウザ内で完結させている。サーバーと通信しないため、一度読み込めばオフラインでも対局できる。

![対局設定](/images/posts/splendor-web-client/match-settings-modal.png)

![盤面](/images/posts/splendor-web-client/initial-board.png)

![AI思考画面](/images/posts/splendor-web-client/game-ai-thinking.png)

## WebGPUとWASMの比較

バックエンドとしてWebGPUも試したが、今回の探索構成では性能向上のメリットがなく、WASMを採用した。

測定環境（Apple M2 / Chromium）におけるPUCT探索（1 leafずつの評価）の測定結果は以下の通りだ。

| バックエンド | 1評価あたりの所要時間 (p50) | 探索速度 |
| :--- | ---: | ---: |
| **WASM (CPU 1スレッド)** | **1.7 ms** | **731 sims/s** |
| WebGPU | 14.5 ms | 88 sims/s |

バッチ1で1局面ずつ逐次評価する構成では、WebGPU呼び出しに伴うバッファ転送のオーバーヘッドが支配的になり、CPU（WASM）のほうが高速だった。
