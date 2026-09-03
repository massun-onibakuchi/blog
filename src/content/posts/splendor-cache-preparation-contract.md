---
title: "Splendor AIの学習設定と実際のデータがずれるバグを直した"
date: "2026-09-04"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "training"]
---

Splendor をプレイする policy-value model を作っている。

最近は value の入力を見直していて、新しい特徴量を使う学習実験を準備している。その実験を production の学習経路へつなぐ途中で、もっと手前の問題が見つかった。

学習設定には「どの特徴量を使うか」「教師データから何行残すか」が書かれているのに、cache を作る処理へその設定が一部渡っていなかった。

特に self-play loop では、sampling の設定が無視されてもエラーにならなかった。

これは学習結果を見る前に直しておく必要がある。

## 学習前にcacheを作っている

教師データは、ゲームごとの局面や policy target、最終的な勝敗などを持っている。

そのまま毎回読み込むのではなく、学習前に必要な行を選び、ニューラルネットワークへ渡す配列へ変換して cache を作る。

大まかには次の流れになる。

```text
教師ゲーム
  ↓
split / sampling
  ↓
feature extraction
  ↓
prepared cache
  ↓
training
```

sampling は、たくさんあるゲームや局面のうち、今回の学習でどれを残すかを決める設定である。

例えば学習行数を約42万行に固定して比較するときは、教師データ全体をそのまま使うのではなく、指定した row budget に合わせて局面を選ぶ。

そのため、sampling が違えば実際にモデルが見る training data も違う。

## runの設定がcacheへ届いていなかった

学習 run には、feature contract と sampling recipe が入っている。

feature contract は「モデルへどの特徴量を、どの形で渡すか」という約束で、sampling recipe は「元データからどの行を採用するか」という約束になる。

ところが cache 作成関数には既定値があり、

```text
feature contract = old v1
sampling = none
```

になっていた。

そして production の `train`、`evaluate-test`、self-play loop の呼び出し側が、run に入っている値をすべて渡していなかった。

新しい特徴量を使う run では feature contract の不一致が後段で検出されるので、こちらは大きな音を立てて失敗する。

一方、self-play loop の sampling は違った。

run の training identity には sampling recipe が入っているのに、実際の cache は `sampling = none` で作れてしまう。さらに当時の cache validation は sampling の一致を確認していなかった。

つまり、設定上は subsampling した学習なのに、実際には full pool を使って学習できる状態だった。

## なぜこれは機械学習的にまずいのか

これは単に metadata が間違うだけではない。

sampling は学習分布そのものを変える。

例えば、同じ教師ゲームから42万行だけ取る実験と、利用可能な行を全部使う実験では、モデルが見る局面数も、各ゲームから受ける重みも、1 epoch の意味も変わる。

さらに optimizer steps を固定していれば、dataset size が変わることで同じ局面を何回見るかも変わる。

この状態で、

```text
sampling recipe Aで学習したモデル
```

として結果を保存しても、実際に学習したデータは recipe A ではない。

比較実験では、モデルの差を特徴量や loss の差だと思っていても、実際には training distribution の差が混ざる可能性がある。

再現実験でも同じ identity を指定したつもりで別のデータを使えてしまう。

そのため今回は、cache を単なる高速化用の中間ファイルではなく、training run の一部として一致を検証することにした。

## runから設定をそのまま渡すようにした

修正は単純で、`train`、`evaluate-test`、self-play loop が cache を作るときに、resolved run の preparation から設定を取るようにした。

```text
resolved training run
  ├─ feature contract
  ├─ split
  └─ sampling
        ↓
prepared cache
```

また training 開始時の validation に sampling も追加した。

これで run と cache の sampling recipe が違えば、学習を開始せずに失敗する。

feature contract についても同様に、現在準備している9個の global feature を使う run なら、cache 側もその contract で作られる。

CLI で cache だけを単独作成する場合には authored training run がないので、その経路だけ feature contract を明示できる option を追加した。

## end-to-endでも確認した

stub の引数だけを見るテストではなく、小さな教師 source を実際に生成して、production の `train` と `evaluate-test` を通すテストも追加した。

新しい feature contract を指定した run から作られた cache は、global feature の幅が9になった。

同じ source と split でも旧 feature contract の cache とは別の cache key になり、test 評価は checkpoint が持つ新しい contract の cache を再利用して有限の metric を返した。

sampling についても、

- runだけに sampling がある
- cacheだけに sampling がある
- seed が違う
- row budget が違う

というケースを失敗させ、同じ recipe の場合だけ学習できることを確認した。

全体の Python test は284件通り、Ruff も clean だった。

## 過去の実験結果を否定する話ではない

今回確認した問題は、generic な production `train` / `evaluate-test` と self-play loop の cache preparation 経路にあった。

すでに完了した個別実験には専用 script で cache を構築しているものもあるため、この発見だけから過去の記事の結果が間違っていたとは言えない。

今回の新しい value feature 実験も、scientific outcome を見る前の段階でこの問題を見つけている。

重要なのは、これから feature contract や sampling を変えて比較するときに、設定ファイルの記述ではなく「実際にモデルが見た cache」まで同じ条件として検証できるようになったことだと思う。

次はこの経路で新しい value feature の学習を走らせ、offline の予測性能と実際の対局性能を見る。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
