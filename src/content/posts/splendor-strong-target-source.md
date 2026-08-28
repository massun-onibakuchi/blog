---
title: "Splendor AIで128回探索の自己対局を8,192局作り、value教師の弱点を測った"
date: "2026-08-18"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

Splendor をプレイする policy-value model を、探索と自己対局で強くしている。

Splendor は、宝石トークンを集めてカードを購入し、買ったカードの色を以後の購入コストの永久割引として使いながら得点を伸ばすボードゲームだ。通常は15点以上を目指す。

モデルは局面ごとに、各合法手の良さを表す policy と、最終的な win / draw / loss を予測する value を出す。実戦ではこの予測を PUCT というゲーム木探索に入れて手を選ぶ。

前の実験では、同じモデルでも探索回数を増やすと明確に強くなり、128 simulations は32 simulations を上回った。そこで今回は探索回数の比較をやめ、128 simulations を固定して「強い探索が作る教師データ」を十分な量だけ作った。

## 128 simulations で8,192局を生成した

自己対局は4,096個の初期配置について席順を入れ替え、合計8,192局を生成した。

各手では128 simulations の PUCT を実行する。序盤12手だけ temperature 1 で手をサンプリングし、その後は最大 visit の手を選ぶ。root には探索の多様性を出すための noise も入れる。

最終的に得られた学習候補は478,364局面だった。

| 指標 | 結果 |
| --- | ---: |
| games | 8,192 |
| eligible decisions | 478,364 |
| simulations / decision | 128 |
| max-ply 打ち切り | 0% |
| policy target fallback | 0.0970% |

policy target fallback は、探索ノイズを除いた後の visit が少なすぎて通常の補正を使えず、raw visits に戻した割合である。約0.1%しかなく、ほぼ全局面で意図した教師分布を作れた。

## policy target はかなり鋭くなった

policy の教師信号には、探索後に各合法手へ何回 simulation が入ったかを正規化した分布を使う。

128 simulations まで読むと、分布はかなり集中した。

| 指標 | 結果 |
| --- | ---: |
| normalized entropy 平均 | 0.2423 |
| top action の平均確率 | 0.7024 |
| top action が99%以上の局面 | 41.7% |
| 平均合法手数 | 26.94 |

合法手が平均27個近くあるのに、探索後は約42%の局面で1手にほぼ全質量が集まっている。

これは「探索が正しい」と証明するものではないが、raw policy をそのまま教師にしているわけではなく、128回読んだ結果としてかなり明確な preference が生成されていることは分かる。

## value教師は終盤と序盤で性質が違った

今回もうひとつ見たかったのが value だった。

通常の value target は単純で、ゲームに勝ったら win、負けたら loss、引き分けなら draw を、そのゲーム中の各局面へ教師として付ける。

一方、探索そのものも各局面で root value を持っている。

簡略化すると、

```text
terminal value
  = 最後まで対局した結果

search root value
  = その局面から128 simulations読んだ時点の評価
```

である。

探索値を少し混ぜれば、1ゲームの最終結果だけを全局面へコピーするより細かい教師信号になるかもしれない。これは以前から試したかった仮説だった。

しかし今回、search root value と最終結果を残り手数ごとに比較すると、かなり強い horizon effect が出た。

| 終局までの残り decisions | root value の MAE |
| --- | ---: |
| 1–8 | 0.3566 |
| 33–64 | 0.9331 |
| 65–160 | 0.9952 |

value は `-1 = loss`, `0 = draw`, `+1 = win` のスカラーとして比較している。

終盤ではある程度最終結果に近いが、ゲーム序盤から中盤では誤差がほぼ1に近い。33手以上残っている局面は216,220 rows、全体の45.2%だった。

つまり、search value は「terminal outcome より細かいから良い教師」と単純には言えない。

PUCT が policy を強く改善できることと、途中の root value が遠い最終勝敗を高精度に予測できることは別問題だった。

## 次は value target だけを変えて比較する

この結果を見て search value を捨てることにはしなかった。

次の学習では同じ478,364局面を使い、同じ初期モデル、optimizer、seed、1 epoch のまま、value target だけを変える。

```text
T: terminal outcome のみ
M: terminal outcome + search value を 1/3 混ぜる
```

この2つは同じ replay cache を使う。違うのは value の教師信号だけにする。

search value がノイズを減らして学習を助けるのか、それとも長い horizon の誤差を自己蒸留してしまうのかを、モデル同士の対局で見る。

以前の実験では複数の変更を同時に動かして原因を切り分けにくいことがあったので、今回は1変数だけ変える形にしている。

## 自己対局生成も速くした

8,192局の生成途中で、native self-play を8 workerへ並列化した。

最初の shard は2,048局に5,214.65秒かかったが、8 worker を使った最後の shard は2,331.88秒だった。約2.24倍の throughput、55.3%の wall time 削減になる。

ただしこれは model quality の改善ではない。探索設定、seed、出力順序は維持しているが、batch shape による浮動小数点差から strict argmax の経路が分岐する可能性までは消せない。そのため今回は「同じ実験を安く回せるようになった」という運用上の成果として扱っている。

今回の本題は、128-simulation PUCT から十分大きな自己対局 source を作り、その policy と value の教師信号を実際に観測できたことにある。

policy 側にはかなり鋭い探索分布ができている。一方、value 側では遠い終局を予測する search value がかなり弱い。

次はこの同じデータから2つの value recipe を学習し、どちらが実際の playing strength につながるかを見る。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
