---
title: "Splendor ML進捗: 評価のものさしを直し、relational PV v2の最初のbootstrapを検証した"
description: "2026年8月12〜13日のSplendor ML進捗。評価系の修正、relational policy-value v2、teacher-only bootstrapの結果と次の課題。"
date: "2026-08-15"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "reinforcement-learning", "search"]
---

2026年8月12日（水）と13日（木）、Splendor の policy-value モデル周辺をかなり進めた。

この2日で一番大きかったのは、単にモデルを新しくしたことではない。**評価の前提を直し、モデル選択のルールを固定したうえで、新しいモデル仮説を実験し、「何が分かっていて、何がまだ分かっていないか」を数字で分けられるようになったこと**だと思う。

結論を先に書くと、relational policy-value v2 の最初の teacher-only bootstrap は成功した。teacher policy の模倣と、同じ teacher trajectory 上の WDL 予測には有用な信号が出た。ただし、これはまだ「実戦で強くなった」という結果ではない。そこは次の search-coupled evaluation に残っている。

## 水曜: まず評価のものさしを直した

モデルを改善する前に、学習データと評価が変なショートカットを教えないようにする変更を入れた。

### max-ply 打ち切りを中立な draw として扱う

ゲームが `max_ply` に達したとき、時間切れに近い人工的な打ち切りから勝敗ラベルを作るのをやめた。打ち切りは terminal ではあるが、WDL value は全プレイヤー 0 の中立結果として扱う。

これをしないと、探索予算や安全上限の都合で終わった局面が「本当の勝敗」として学習や arena に混ざる。モデルが強くなったのか、単に打ち切りの癖を覚えたのか分からなくなるので、地味だが重要な修正だった。

- [fix: neutralize max-ply game truncations](https://github.com/massun-onibakuchi/sml/commit/64fba0bbe4be84712cb6ee94e9a1b0c6276841f6)

### market の slot 番号をモデル入力から外した

market の「何番目の slot にカードが置かれているか」は、ゲームの本質的な意味ではない。そこで slot 座標を learned feature から外し、slot permutation に対してモデル入力・出力が equivariant になることをテストで固定した。

これは、データ生成側の並び順にモデルが過剰適合する余地を減らすための変更だ。

- [fix: remove slot features from model inputs](https://github.com/massun-onibakuchi/sml/commit/919c77a14b7d95027c9987ca9e39b67886fcbdc2)
- [test: prove slot permutation equivariance](https://github.com/massun-onibakuchi/sml/commit/0dd041bb8e4c80472a86fbb19bdd47b5838575e1)

### validation と test を分離し、checkpoint 選択を validation だけにした

学習時の checkpoint 選択と最終評価を分けた。validation で best checkpoint を選び、test は選択後の評価にだけ使う。

- [fix(training): separate validation and test evaluation](https://github.com/massun-onibakuchi/sml/commit/36ae0a73a5f471d14aaf970d35cdabd615521438)
- [feat(training): select best validation checkpoint](https://github.com/massun-onibakuchi/sml/commit/d039dc1640116ef9670ff2c3e5b76984036f1caa)

あとで分かったが、この変更は形式的な整理ではなかった。今回の bootstrap では終盤に WDL がかなり overfit したため、validation selection が実際に悪い terminal checkpoint を避けている。

arena には random baseline も追加した。teacher や learned model 同士だけを比較するより、「最低限ここは越えているか」を見る基準がある方が実験を解釈しやすい。

- [feat(arena): add random baseline evaluation](https://github.com/massun-onibakuchi/sml/commit/7ed35bc8294bbe61e89d9e1462fdb3f822f2a799)

## 木曜: relational policy-value v2 を入れた

これまでの policy-value model は、player / card / noble を個別に encode してから pool し、その後に MLP で処理していた。Splendor では「この player の資源でこの card を買える」「この card bonus がこの noble 条件に効く」「相手がこの market card を狙える」といった**オブジェクト間の関係**が大事なので、pool 前に関係を処理する構造へ変えた。

概念的にはこういう変更になる。

```text
before: independent object encoders -> pool -> residual MLPs
after:  fixed object set -> relational blocks -> pool -> residual MLPs
```

v2 では固定長の public object set に2層の relational block を通し、contextualized された player / market / noble / reserve を pool する。policy head から参照する object も、独立 encode 済みのものではなく relational context を持った表現になった。

一方で、最初から何でも attention にしたわけではない。candidate-to-candidate attention は入れず、既存の public feature tensor と ONNX interface も維持した。標準モデルは約 1.385M parameters で、単純に巨大化するより「pool 前に関係を考える」方へ capacity を移している。

- [feat(model): add relational policy-value v2](https://github.com/massun-onibakuchi/sml/commit/bf0efb7592c4d708c5929a6725ae12ece8ae41c8)

## 最初の PV bootstrap: teacher はかなり模倣できた

relational v2 で、teacher trajectory だけを使った supervised policy-value bootstrap を実行した。self-play や model-driven search のデータはまだ学習に混ぜていない。

8,000 optimizer steps 学習したが、採用したのは validation で選ばれた step 3,356 の checkpoint だった。

### Policy head

held-out teacher trajectory 上の policy 指標は次の通り。

| Metric | Result |
| --- | ---: |
| Teacher target entropy | 0.6755 |
| Policy cross-entropy | 0.9188 |
| Policy KL | 0.2432 |
| Policy top-1 accuracy | 68.15% |
| Teacher sampled action との agreement | 65.38% |

uniform candidate を仮定した cross-entropy が約 3.19 なので、teacher policy の模倣としては明確な信号が出ている。

ただし、平均だけを見ると少し楽観的になる。test split の teacher target は、40.0% がほぼ one-hot、27.2% が support 2〜4、32.8% が support 5 以上だった。post-hoc inference の top-1 accuracy はそれぞれ **97.8% / 85.9% / 17.4%**。つまり、teacher の選択が鋭い局面はかなり再現できる一方、序盤など選択肢が拡散する局面はまだ難しい。

### WDL head

WDL は単純な prevalence baseline より良かった。

| Metric | Model | Constant baseline | Improvement |
| --- | ---: | ---: | ---: |
| WDL cross-entropy | 0.6840 | 0.7210 | 5.1% lower |
| WDL Brier | 0.4443 | 0.5049 | 12.0% lower |
| Scalar value MAE | 0.8157 | 0.9950 | 18.0% lower |
| WDL accuracy | 63.26% | 49.74% | +13.5 pt |

ただし、1 episode の全 state は同じ最終結果を共有するので、24,542 rows を完全に独立な標本として扱うのは強すぎる。episode cluster 単位の post-hoc 比較では Brier / value MAE / accuracy の改善は残ったが、WDL CE の改善区間は 0 をまたいだ。

「良さそうな数字が出た」だけで終わらず、依存構造を考慮するとどこまで言えるかを分けたのは大事だった。

## validation selection は本当に必要だった

今回、step 3,356 の selected checkpoint と step 8,000 の terminal checkpoint を比較すると、policy imitation は後半も少し改善する一方で、WDL は明確に崩れた。

| Checkpoint | Joint loss | Policy CE | WDL CE | WDL accuracy |
| --- | ---: | ---: | ---: | ---: |
| **3,356 selected** | **1.2824** | 0.9303 | 0.7043 | 65.86% |
| 8,000 terminal | 1.4900 | 0.9120 | 1.1560 | 61.82% |

selected から terminal までに validation WDL CE は **64%悪化**し、joint loss も **16%悪化**した。training WDL loss は下がり続けていたので、validation を見ずに「最後まで学習した checkpoint」を使っていたら、むしろ悪いモデルを採用していた。

水曜に入れた checkpoint selection が翌日の実験でちゃんと役に立った形だ。

- [Analyze retained PV bootstrap experiment](https://github.com/massun-onibakuchi/sml/commit/544d1c6840a5f0dfc8506141c8b04884786c2b38)

## teacher generation も36.6%軽くなった

teacher の lookahead と native execution で、すでに生成・authorization 済みの candidate batch を再利用するようにした。policy bytes と episode bytes を変えずに、計測した full generation workload は **36.6%減少**した。

学習ループを回す段階では teacher data generation のコストも実験速度を決めるので、モデル改善とは別軸だがかなり効く改善だと思う。

- [perf(teacher): reuse authoritative candidate batches](https://github.com/massun-onibakuchi/sml/commit/c9af74ca5dd8f42d7a98b25ae06d7096f6128b9f)

## うまくいったこと、まだダメなこと

今回うまくいったのは、次の4点。

1. max-ply や slot ordering のような人工的な要因を学習・評価から外せた。
2. validation-only checkpoint selection が、実際の late WDL overfit を回避した。
3. relational v2 は既存の tensor / ONNX 境界を保ったまま学習でき、teacher policy をかなり模倣した。
4. teacher generation の同一出力を保ちながら、ワークロードを36.6%削減できた。

一方、まだ言えないこともはっきりしている。

**この bootstrap が Splendor を強くプレイする証拠はまだない。** offline policy top-1 や terminal-WDL の改善を、そのまま Elo や playing strength に読み替えることはできない。model-driven search が訪れる state への generalization、draw prediction、self-play での安定性も未確認だ。

次は selected checkpoint を固定したまま native ONNX/PUCT smoke を通し、固定 search setting で PV vs random を測る。その lower bound が 0.5 を越えるなど、事前に決めた gate を通ってから bounded RL generation に進む。

今回の2日間で一番良かったのは、「loss が下がったから進歩した」と言わずに済む状態になったことかもしれない。**teacher を模倣できたこと**と、**実際に強くなったこと**を別の問いとして扱えるようになった。次は後者を測る。
