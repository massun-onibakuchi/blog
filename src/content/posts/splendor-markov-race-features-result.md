---
title: "Splendor AIに手番と得点レースの特徴量を入れたら対局でも強くなった"
date: "2026-09-08"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "value"]
---

Splendor をプレイする policy-value model を作っている。

以前、value の入力に手番の情報が足りていないことに気づき、手番側が先手かどうか、得点差、購入カード枚数差、双方の15点までの距離を追加する実験を始めた。

その実験が最後まで終わった。

結果は、未知の局面で value の予測が改善し、32 simulation の探索を使った対局でも強くなった。今回の特徴量は採用することにした。

## 何を比較したか

Splendor は、どちらかが15点以上になった瞬間に終わるのではなく、そのラウンドの手数を揃えてから勝敗を決める。

そのため value を予測するときは、得点やカードだけでなく、現在の手番プレイヤーが先手かどうかも必要になる。

従来の入力では、その情報が value head から直接見えていなかった。

新しい入力では、従来の global feature 4個に次の5個を追加した。

- 手番側が先手かどうか
- 得点差
- 購入カード枚数差
- 自分の15点までの距離
- 相手の15点までの距離

最初の案では現在の手数を表す `game_ply` も入れていたが、最終的な実験からは外した。

`game_ply` はルール上必要な状態ではなく、自己対局や探索方針によってゲーム長が変わると、それ自体を近道として学習する可能性があるためである。

最終的な treatment は global feature 9個の model になった。

## 8組の paired experiment を行った

control と treatment を8組作り、同じ教師データと学習条件で比較した。

1つの arm で使う条件は次の通り。

```text
29,400 groups
58,800 games
419,840 training rows
maximum 16,000 optimizer steps
batch size 512
```

各 model は1,000 stepごとに checkpoint を保存し、固定した validation set で joint loss が最小のものを選んだ。

選ばれた checkpoint はすべて 10,000〜14,000 step の範囲だった。16,000 step の上限に張り付いていないので、単純に学習時間が足りず treatment だけ得をしたという形にはなっていない。

test set を見る前に、control と treatment の checkpoint 選択を16個すべて固定した。そのあと初めて未知の test set で評価した。

## value の予測が改善した

主な offline 指標は WDL Brier score にした。

WDL は loss / draw / win の3クラスの確率で、Brier score は予測確率と実際の結果のずれを見る指標になる。小さい方が良い。

8組の treatment - control の差は次のようになった。

```text
mean difference: -0.011508
one-sided 95% upper bound: -0.008802
adoption threshold: mean <= -0.0027
```

改善量は事前に決めていた materiality threshold を超え、信頼区間の上限も0より小さかった。

policy の模倣精度が悪化していないかも確認した。policy KL の one-sided 95% upper bound は 0.003634 で、許容上限の 0.01 を下回った。

つまり今回の変更では、value を改善する代わりに policy を壊したという結果にはならなかった。

## 終盤ほど効いていた

局面からゲーム終了までの長さでも分けて見た。

すべての horizon で treatment の WDL Brier が良かったが、改善は特に終盤で大きかった。

```text
remaining decisions 1-8:  -0.0253
remaining decisions 33+:   -0.0065
```

これは今回の仮説と合っている。

手番側が先手かどうかは、15点へ到達したあとに相手へもう一度手番が回るかという終局条件に直接関係する。ゲーム終了が近い局面ほど、その情報が value に効きやすい。

もちろん horizon 別の結果は探索的な分析であり、この差だけを独立した発見として確定したわけではない。それでも、改善した場所が想定していた場所と一致しているのは興味深い結果だった。

## 実際の対局でも強くなった

offline の条件を通過したので、最後に fresh arena を行った。

control と treatment を、それぞれ32 simulation の PUCT で対局させた。8 replicates、合計8,192局を使った。

結果は次の通り。

```text
mean pair score: 0.523560
standard error: 0.006280
one-sided lower bound: 0.511662
```

事前の採用条件は、平均が0.52以上、lower bound が0.5より大きいこと、さらに8 replicates のうち6つ以上が0.5以上であることだった。

実際には8つ中7つが0.5以上になり、すべての条件を通過した。

replicate ごとの pair score は次の通りだった。

```text
0.52002
0.54492
0.51855
0.49561
0.50439
0.54199
0.53857
0.52441
```

1組だけ0.5を下回っているので、どのデータや乱数でも必ず強くなるほど大きな効果ではない。

それでも全体では、未知の局面での value 改善だけでなく、探索を通した playing strength まで改善した。

## 今回分かったこと

今回の実験では、モデルを大きくしたわけでも、教師データを増やしたわけでも、探索回数を増やしたわけでもない。

足りていなかったゲーム状態を value へ渡した。

以前は、ゲーム数を 29,400 groups から 58,800 games 相当まで増やしても playing strength の改善が飽和していた。今回はデータ量ではなく、状態表現の欠落を直したことで前進した。

value model では、ネットワークの容量や学習量だけでなく、「同じ入力として扱っている2つの局面が、本当に同じ価値を持つのか」を確認することが重要だと分かった。

今回の条件では、global feature 9個の新しい feature contract と model を採用する。

次は、この表現を基準にして、value の学習方法や自己対局の更新方法をさらに調べていく。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
