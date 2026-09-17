---
title: "Splendor 2人戦でモデルに渡る合法手は最大554候補"
date: "2026-09-18"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "game-ai"]
---

Splendor の policy-value model を作っている。

現在の policy は、局面ごとに生成した合法手を candidate として並べ、それぞれに logit を出す形にしている。

このとき気になるのが、1局面に candidate が最大でいくつ存在するかである。

2人用 Splendor の現在の no-blind action semantics について調べたところ、model に渡る candidate 数の最大値は 554 だった。

## raw actionの数ではない

ここで数えているのは、engine 内部で生成される raw な手順の数ではない。

例えば token を3色取ったあと、10枚制限のために token を返す場合、異なる「取る順序・返す組み合わせ」から同じ最終 token delta に到達することがある。

policy から見ると、それらは同じ結果を生む同じ action なので1 candidate に正規化する。

今回の554という数字は、この canonicalization 後の model-facing candidate 数である。

最大局面では token take / return の raw trace が478通りあるが、最終的な net token delta でまとめると168 candidateになる。

## 277通りのactionが貴族で2倍になる

最大値を作る局面では、手番プレイヤーが10 tokenを持ち、reserve は2枚、3つの deck はすべて残っていて、bank に gold も残っている。

さらに、すでに獲得条件を満たしている noble が2枚残っている。

noble を選ぶ前の action 数は次のようになる。

| action | candidates |
| --- | ---: |
| token take / return | 168 |
| visible reserve | 72 |
| visible card purchase | 31 |
| reserved card purchase | 6 |
| total | 277 |

Splendor では1ターンに獲得できる noble は1枚だけなので、この局面では各 action のあとに2通りの noble choice が存在する。

したがって、

277 × 2 = 554

となる。

これは単に組み合わせ上あり得る数字ではない。52 ply でこの局面まで到達できる手順も構成できており、上側についても token hand と noble の状態を場合分けして有限探索した結果、554を超えないことを確認している。

## 512では足りなかった

これまで model export の wide-candidate probe では K=512 を使っていた。

ただし512は runtime の上限ではなく、広い candidate tensor を通すための確認用サイズだった。実際の EAT / ONNX interface は candidate width K を可変長として扱っている。

今回、到達可能な最大値が554だと分かったため、export 時の conformance probe も K=554 まで通すようにした。

モデル自体に固定の554上限を追加したわけではない。重要なのは、少なくとも実際に到達可能な最大幅を export / inference 経路で通しておくことである。

## blind reserveを一手で表すなら590

将来 blind reserve を atomic な candidate として扱う場合は、同じ考え方で最大590になる。

この数字は、blind reserve を

- deck tier
- 最終 token delta
- noble choice

で表し、引いた hidden card の identity は chance outcome として扱う場合のものになる。

最大局面では3 tierそれぞれについて6通りの reserve 後 token delta があり、noble choice が2通りなので、blind reserve 分として

3 × 6 × 2 = 36

candidate が追加される。

したがって554 + 36 = 590になる。

ただし、blind reserve を複数 decision に分ける場合や、hidden card identity 自体を candidate identity に含める場合はこの数字は変わる。

## 分かったこと

Splendor は1ターンの action type 自体は多くないが、支払い方法、token return、対象カード、noble choice を全部 model-facing candidate に展開すると、合法手集合はかなり広くなる。

一方で raw trace をそのまま数えると、同じ最終 action を重複して数えてしまう。policy が実際に選ぶ単位まで canonicalize してから action space を考える必要がある。

EAT では candidate 数を固定分類数にせず、局面ごとの可変長集合として扱っている。今回の554という上限は、その設計をどの幅まで実際に成立させる必要があるかを具体的にした結果になる。

---

この記事は、実装・調査記録をもとに、本文の大部分をLLMが執筆・編集し、筆者が内容を確認・編集しています。
