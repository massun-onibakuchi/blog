---
title: "Splendor AIで教師データをさらに2倍にしたが、対局の強さは伸びなかった"
date: "2026-08-30"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "training"]
---

Splendor をプレイする policy-value model を作っている。

以前の実験では、学習に使う行数を約42万行に固定したまま、教師データを取るゲーム数を7,350局から29,400局へ増やすと、value の汎化性能と実戦の強さが改善した。

そこで、同じ方法でゲーム数をさらに2倍にするとまだ強くなるのかを試した。

結果から先に書くと、value の予測誤差は少し改善したが、対局では強くならなかった。

## 実験方法

Splendor では同じ初期配置を先手・後手を入れ替えて2局行い、これを1 groupとして扱っている。

今回は次の2条件を比較した。

| | G14 | G29 |
| --- | ---: | ---: |
| training groups | 14,700 | 29,400 |
| games | 29,400 | 58,800 |
| 学習行数 | 419,840 | 419,840 |
| 1ゲームあたりの平均採用行数 | 14.28 | 7.14 |
| optimizer steps | 8,000 | 8,000 |

ゲーム数だけを増やし、モデル、教師、loss、optimizer、学習行数、optimizer steps は固定した。

G29 はG14の2倍のゲームを見るが、学習する行数は同じなので、1ゲームから採用する局面は半分になる。

これは「同じ42万行を、少数のゲームから密に取るか、多数のゲームから薄く取るか」の比較になる。

乱数による差を小さくするため、12組の paired replicate を作った。各 replicate でG14とG29は同じ初期パラメータと学習順序のseedを使い、合計24モデルを学習した。

checkpoint は validation data に対する既存の joint loss が最小のものを選んだ。test data や対局結果を見てから checkpoint を選び直すことはしていない。

## 学習曲線とcheckpoint選択

まず training loss の推移を見ると、24モデルの学習がどのように進んだかを確認できる。ただし、これは学習に使ったデータ上の最適化を確認するための診断であり、G29の汎化性能が高いことを示す結果ではない。

![G14とG29のtraining lossの推移。学習過程を確認するための診断で、held-out testの結果ではない。](/images/posts/splendor-group-scaling-saturation/training-losses.png)

各モデルは1,000 stepごとに8個のcheckpointを作り、同じ validation data で評価した。通常採用する joint-loss checkpoint はかなり終盤に集中し、G14では7,000 stepが5個、8,000 stepが7個、G29では7,000 stepが2個、8,000 stepが10個選ばれた。

次の図は、そのcheckpointごとの validation 指標を見るためのものだ。今回の8,000 stepという学習予算の端に選択が集中していることは、より長く学習した場合に結果が変わる余地を考える材料になる。一方で、この図だけからG29の方が強いとは判断できない。

![1,000 stepごとのcheckpointをvalidation dataで評価した指標。最終checkpointの選択過程を見るための図。](/images/posts/splendor-group-scaling-saturation/validation-per-checkpoint.png)

paired replicate ごとの validation 上の差も確認した。これは同じseed条件で作ったG14とG29の差が、model selectionに使うデータ上でどの程度ばらつくかを見るための補助診断である。

![paired replicateごとのvalidation delta。G14とG29のvalidation上の差を見るための診断。](/images/posts/splendor-group-scaling-saturation/paired-validation-deltas.png)

ここで重要なのは、これら3枚はいずれも最終的な効果判定そのものではないことだ。validation はcheckpoint選択にも使っているため、G29の改善を確定する主結果にはできない。次の節では、選択後まで触れていない別の4,096 groupsを使って評価する。

## value は少し良くなった

未知の4,096 groupsに対して、勝ち・引き分け・負けの予測を Brier score で評価した。Brier score は小さい方が良い。

G29とG14の差は、

```text
G29 - G14 = -0.0027625
```

だった。

事前に決めていた改善幅は `-0.0027` なので、ぎりぎりだが success の条件を超えた。片側95% upper bound も `-0.00220` で0より小さく、12/12 replicate でG29側のBrier scoreが低かった。

残り手数で4つに分けた horizon 別の評価でも、すべてG29側が改善した。

policy の模倣性能も悪化しておらず、policy KL の non-inferiority 条件を通った。

ここだけを見ると、ゲーム数をさらに増やす価値はありそうに見える。

## しかし対局では差がなかった

最終的には、同じ32-simulation PUCTを使ってG29とG14を対局させた。

pair score は、先後を交換した2局を1組として見た平均スコアで、0.5なら互角になる。

結果は、

```text
G29 vs G14
pair score = 0.4974
90% CI = [0.487, 0.507]
```

だった。

ほぼ0.5で、区間も0.5をまたいでいる。

つまり、offline の value prediction は改善したが、その差は今回の探索条件での playing strength にはつながらなかった。

この結果から、29,400 groups / 58,800 games の設定を「より強いrecipe」として採用することはしないことにした。

## 前回ほどは効かなくなっている

以前は、3,675 groupsから14,700 groupsへ増やすことで、value だけでなく arena でも明確な改善が出た。

今回は14,700から29,400へさらに増やしたが、改善はoffline valueだけに留まった。

過去の改善量から group 数の log2 dose に比例して伸びると単純に外挿した場合と比べると、今回得られた value 改善は約35%だった。

少なくとも現在の約42万行という学習予算では、「独立したゲームを増やして1ゲームから薄く取る」というレバーは飽和し始めていると考えている。

もちろん、ゲーム数そのものが不要になったという意味ではない。今回固定したのは行数とstep数なので、より大きな学習予算では結果が変わる可能性がある。

## valueを重視したcheckpoint選択も試した

今回は exploratory に、通常の joint loss で選ぶ checkpoint とは別に、policy KL の悪化を制限しながら value Brier が最も良い checkpoint を選ぶ方法も試した。

これを通常の checkpoint と対局させた結果は、pair score `0.4972` だった。また12 replicate中8つでは、そもそも両方の方法が同じ checkpoint を選んだ。

この selector も、現在の形のまま追う理由は弱いと判断した。

## 次に試すこと

今回分かったのは、教師ゲーム数を増やせば value の汎化誤差はまだ少し下がるが、その改善だけでは強さが上がらないということだった。

また、通常のcheckpoint選択が7,000〜8,000 stepに集中していたので、8,000 step固定そのものが次に検討すべき要因の一つではある。ただし、今回の実験から「学習stepを増やせば強くなる」とまでは言えない。

次は単純に group 数をさらに増やすのではなく、value 学習そのものを変える方向を試す。現在は、同じ policy 学習の中で value 用の情報量を増やす dual-stream value learning を次の候補にしている。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
