---
title: "Splendor AIを2世代回したが伸びなかったので、学習量不足を切り分けた"
date: "2026-08-16"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "reinforcement-learning", "training"]
---

前回は、教師あり学習で作った policy-value model を PUCT に接続し、自己対局から challenger を学習して、最初の promotion が通るところまで進めた。

ただし、1回の promotion が成功しただけでは「自己対局を繰り返せば継続的に強くなる」とは言えない。

そこで次は、小さい generation を2回つないでみた。

結果から言うと、今度は2世代とも challenger が incumbent を越えられなかった。

さらに「1 epochしか学習していないからでは」と考えて学習量を8倍まで増やしたが、改善するどころか明確に悪化した。

今回は、最初の promotion の次に起きた停滞と、その原因をどう切り分けたかを書く。

## 小さい generation を2回つないだ

前回 promotion に成功した generation は、1,024個の初期配置を席順交換して2,048局の自己対局を生成していた。

今回はその半分の512組、1,024局を1 generationとして、2 generation続けて回した。

学習では引き続き supervised data を anchor として残し、自己対局データは直近2世代まで replay に保持する。

各 generation では、

```text
incumbent
    ↓
自己対局 1,024 games
    ↓
anchor + replay で challenger を1 epoch学習
    ↓
challenger vs incumbent
    ↓
promote / reject
```

を実行した。

どちらの generation も全局が通常終了まで到達し、max-ply による打ち切りはなかった。

自己対局データ自体も前回と大きくは変わっていない。

| 指標 | Generation 0 | Generation 1 |
| --- | ---: | ---: |
| 自己対局 | 1,024 games | 1,024 games |
| 学習対象の自己対局局面 | 59,368 | 59,066 |
| 平均 game length | 57.98 decisions | 57.68 decisions |
| policy target entropy | 0.3261 | 0.3282 |
| top action の平均確率 | 0.6254 | 0.6229 |

Generation 1では2世代分の replay が残るため、学習データの約79.9%が supervised anchor、約20.1%が self-play replay になった。

これは前回 promotion に成功したときの約80/20にかなり近い。

それでも promotion は起きなかった。

## 2世代ともほぼ五分で reject された

各 challenger は incumbent と、100個の初期配置を席順交換した200局で対局した。

結果は偶然にも両 generation で同じ96勝2分102敗だった。

| 指標 | Generation 0 | Generation 1 |
| --- | ---: | ---: |
| challenger / draw / incumbent | 96 / 2 / 102 | 96 / 2 / 102 |
| pair score | 0.4850 | 0.4850 |
| one-sided lower bound | 0.4149 | 0.4156 |
| 判定 | reject | reject |

promotion 条件は lower bound が0.5を上回ることなので、どちらも明確に届いていない。

重要なのは、loss がまったく動いていなかったわけではないことだった。

Generation 1の challenger は、Generation 0 の replay に対する policy KL を0.5135から0.4572まで下げている。新しい self-play target をある程度は学習している。

しかし、その変化は対局上の強さには現れなかった。

ここで次の疑問が出た。

「1 epochでは、self-playから得た改善信号を十分に吸収できていないのではないか」

## 1 epoch不足を疑って8 epochまで学習した

この仮説は、新しい自己対局を追加せずに検証できる。

Generation 1で実際に使ったデータをそのまま固定し、incumbent から warm startする同じ学習 recipe の `max_epochs` だけを1から8へ増やした。

元のGeneration 1 challengerを1-epoch armとして再利用し、8-epoch armだけを新しく学習した。

ところが、held-out replay に対する policy KL は長く学習しても改善し続けなかった。

| Epoch | Replay policy KL | Replay value loss |
| ---: | ---: | ---: |
| 0: incumbent | 0.4963 | 0.6706 |
| 1 | 0.4762 | 0.7215 |
| 3 | 0.4666 | 1.0320 |
| 8 | 0.5575 | 2.2897 |

policy は3 epoch付近で少し良くなったあと悪化した。

それ以上に大きく壊れたのが value だった。

8 epoch後には replay value loss が0.6706から2.2897まで増えた。training loss は下がっているのに validation loss は大きく上がっており、典型的な overfitting になっている。

対局でも同じ方向だった。

| 対局 | pair score |
| --- | ---: |
| 1 epoch vs incumbent | 0.5008 |
| 8 epoch vs 1 epoch | 0.4150 |
| 8 epoch vs incumbent | 0.4608 |

1-epoch challenger と incumbent の比較は300 pairsまで増やしても0.5008で、ほぼ完全な五分だった。

一方、8-epoch model は1-epoch modelに対して0.4150しか取れず、incumbentにも0.4608だった。

つまり「本当は改善しているのに、1 epochでは学習し切れていなかった」という説明は支持されなかった。

なお、実際の loop は validation loss が最も良い checkpoint を選ぶので、8 epochまで走らせても選ばれるのは epoch 1になる。単純に `max_epochs` を増やす変更は、計算量だけ増やして元の地点へ戻ることになる。

## 長く学習するとvalue headが先に壊れた

policy と value では教師信号の粒度が違う。

policy target は各 decision ごとに探索から新しい分布が得られる。

一方、value target はそのゲームの最終結果なので、同じ episode 内では全局面が同じ win / draw / loss を共有する。

episodeを $e$、その最終結果を $z_e$ とすると、value target は各手 $t$ に対して

$$
y^{value}_{e,t} = z_e
$$

になる。

今回のデータでは、1 game あたりおよそ58 decisionsある。

全体では policy head が約537,000個の decision-level targetを見る一方、value の結果は10,240 episodesから来ており、同じ結果が平均約58回ずつ異なる局面に付いている。

これは「value の effective sample size が正確に58分の1」という意味ではない。局面自体は異なるので、単純な独立標本数には置き換えられない。

ただ、target の粒度としては policy よりはるかに粗い。

実際、8 epoch学習では WDL accuracy が完全に崩れるより先に cross entropy と Brier score が悪化した。勝敗を識別する能力を全部失ったというより、間違っている局面に対して過剰に自信を持つ方向へ進んでいた。

この結果から分かるのは、「長く学習すると value head が overfit する」ということまでである。

これを、そのまま2世代の rejection の原因だとは言えない。

1 epoch時点の value はまだ大きく壊れていないし、実際の1-epoch challengerは held-out decisions の約90%で incumbent と同じ手を選んでいた。

production loop で観測したのは、壊れた challenger ではなく「incumbent とほとんど同じ challenger」ができる現象だった。

## 次は「学習量」ではなく「改善信号そのもの」を測る

ここまでで、少なくとも単純な説明をひとつ消せた。

```text
2世代とも promotion しない
    ↓
1 epochでは足りない？
    ↓
8 epochまで増やす
    ↓
policy はほとんど改善せず、value は overfit
    ↓
学習量不足では説明できない
```

では、self-play targetには、そもそもどれくらい強い改善信号が入っているのか。

現在の self-play では、incumbent の policy をそのまま教師にしているわけではない。incumbent を PUCT で探索し、その visit distribution を次の policy target にしている。

もし探索をかけても raw policy とほとんど同じ強さなら、challenger が incumbent の近くに留まるのは不思議ではない。

逆に、同じモデルでも探索をかけるだけで明確に強くなるなら、改善信号は存在しているのに学習側が十分取り込めていない可能性が高くなる。

次に測るべきものは、同じ model を固定したまま simulation budget だけを変えたとき、PUCT が playing strength をどれくらい増幅しているかだった。

次の記事では、その search amplification を実際に測った結果を書く。

---

※ 本記事は、実験ログ・コード・計測結果をもとに、AI と共同編集した。
