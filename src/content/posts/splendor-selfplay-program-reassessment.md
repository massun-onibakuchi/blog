---
title: "Splendor AIの25本の実験を横断して、研究計画を組み直した"
date: "2026-09-29T09:58:19Z"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を作っている。

ここ数週間、self-play、PUCT、action representation、終盤の探索、データ生成、学習速度などを個別に調べてきた。実験ごとにはそれぞれ次の一手が見えていたが、局所的な結論を積み上げるだけでは、最終的にどこへ計算資源と実装時間を使うべきか分かりにくくなってきた。

そこで今回、これまでの25本の experiment report をいったん横に並べ直した。

各 report の「次にこれをやるべき」という提案はそのまま採用せず、実測された metrics と artifacts だけを材料にして、長期目標である Board Game Arena の Splendor leaderboard で top-5% 相当まで強くするには、今どこが制約になっているのかを見直した。

結論として、研究の重心をかなり変えることにした。

これまでは action contract、終盤 search rule、局所的な policy の弱点を細かく掘る比重が高かった。今後はまず、

- 強さを継続的に測れる evaluation instrument を作る
- self-play generation を実際に継続する
- policy / value target の作り方を比較する
- 1世代あたりの updates と data quantity を調べる
- その後に collection の breadth / search depth や start-state diversity を調べる

という順に進める。

理由は、25本を横断すると「今のネットワークが小さすぎる」「終盤 search rule が足りない」といった仮説より、学習 recipe と測定系の方が明らかに未検証だからである。

## self-play loop自体は機能している

まず確認できたのは、現在の self-play loop が何も学べていないわけではないことだった。

教師あり学習直後の G0 から、PUCT self-play と再学習を3世代進めた G3 までを同じ fixed opponent panel で比較すると、平均 score は +10.87 percentage points 改善している。

95%区間は [+9.16, +12.57] で、3つの独立 training track × 3 opponents の9 cellsすべてが改善方向だった。

その後、G3 の self-play 時に使う PUCT parameter を

`c_puct = 1.5, fpu_reduction = 0.25`

から

`c_puct = 0.75, fpu_reduction = 0.0`

へ変更し、同じ G3 parents から G4 を作る learner-transfer 実験を行った。

この変更だけでも、次世代 network は primary composite で +3.26 points、fixed-network 95% interval [+2.06, +4.45]、collection replicate level [+1.40, +5.12] だった。

つまり、search self-play から次世代 policy-value model へ強さが transfer する経路は実際に動いている。

ここは重要だった。

「もっと良い model architecture を作らないと先へ進まない」という状態ではない。

少なくとも現在の約0.9M parameter の EAT でも、self-play recipe を変えると downstream playing strength が動く。

## ただし、まだlearning curveを持っていない

一方で、「G0からG3まで伸びたので、このまま何世代回せばどこまで行くか」は分からない。

実際にある search self-play generation は4世代程度で、途中で evaluation opponent、search contract、parameter、measurement protocol が変わっている。

G1 の gain、G3 の endpoint、G4 の learner-transfer をそのまま一本の learning curve として並べることはできない。

特に G4 control が G3 parent に対して約50%だったからといって、「もう plateau した」とも言えない。

1世代だけ、ひとつの recipe で伸びなかった可能性と、長期的な capacity / data ceiling は別だからである。

これまで model や search の細部を調べる実験は多かったが、「同じ recipe で generation を継続したとき、どの速度で強くなるか」という最も基本的な系列がまだない。

そこで今後は、G5、G6、G7……と lineage を継続し、数世代にわたる傾向を見ること自体を主要な実験にする。

## いちばん弱いのは強さの測定だった

25本を横断したとき、最も大きな問題は evaluation だった。

現在よく使っている外部 opponent は、depth-3 teacher、point rush、reserve anchor などである。

point rush と reserve anchor は学習済み network ではなく、手作りの評価規則で行動する rule-based agent だ。

G4 はこの2つにすでに88〜90%程度勝つ。

ここまで勝率が上がると、小さな改善を判定する instrument としては鈍くなる。

256-game cell なら、勝率90%付近でも単純な binomial standard error が約1.9 percentage pointsある。

実際、G4 learner-transfer では lineage の親モデル群に対する league half が +5.30 points と明確に動いた一方、rule-bot half は +1.22 pointsで interval が0を跨いだ。

弱い固定 opponent に勝てるかどうかは確認できても、次の1〜2 pointsの改善を測るには飽和し始めている。

では lineage の過去モデルを相手にすればよいかというと、それにも問題がある。

G3 parents や historical checkpoint に対する改善は、同じ model family、同じ search machinery の内部比較である。

これは感度の高い測定ではあるが、family 全体が同じ方向へ co-adapt している場合や、非推移的な戦略変化には弱い。

さらに、現在の score と BGA の leaderboard percentile を接続する anchor はまだない。

つまり今は、

「内部では改善を測れるが、その改善が最終目標にどの程度近づいたか分からない」

という状態になっている。

そのため次の最優先は、model を変えることではなく、同じ条件で歴代 checkpoint を比較し続けられる frozen strength ladder を作ることにした。

G0、G3、固定した G4 models、rule-based agents、さらに current network を大きめの search budget で動かした challenger を並べ、今後の generation を常に同じ ladder へ当てる。

評価 search contract も固定し、過去の v2 / v3 / v4 の score をそのまま時系列として混ぜない。

研究を続けるための「物差し」を先に固定する。

## searchを細かく直すリターンは小さくなってきた

終盤 search には実際にバグに近い問題があった。

G3 の敗戦を replay すると、相手に即勝ちがあるのに低い policy prior のため128 simulationsでその reply が一度も探索されず、負ける手を Q 0.9 近くで評価している局面が見つかった。

そこで即勝ち terminal を engine で厳密に判定する `sml-puct-v3` を入れたところ、point rush / reserve anchor panel で +0.82 points、95% [+0.37, +1.28] 改善した。

これは修正する価値があった。

しかし、その次に final decision 全体を exact に解く `sml-puct-v4` まで広げると、v4 − v3 は +0.09 points、95% [−0.15, +0.32] だった。

終盤の exactness をさらに増やしても、playing strength の改善はほぼ解決できない大きさになった。

同様に、noble を取れる手や高得点 card へつながる手を特別に探索する heuristic も調べたが、production search rule として採用するだけの結果は得られなかった。

ここからは、`sml-puct-v5` のようにさらに個別ルールを足すより、self-play の target と data distribution を改善する方へ計算資源を使う。

PUCT の `c_puct` / `fpu_reduction` についても、128 simulations の operating point では十分な比較をした。

同じ budget の周辺 grid をさらに細かく掘る優先度は下げる。

## action stagingはstrength研究の主軸から外す

もう一つ長く調べていたのが staged action だった。

Splendor では visible card を取ったあとに refill が起き、その新しい公開情報を見てから token return や noble selection を行える場合がある。

atomic action では refill 前に cleanup まで決めるため、この情報を使えない。

そこで action を MAIN と CLEANUP に分け、refill 後に判断を再開できる staged representation を調べていた。

情報理論的には post-refill recourse に価値がある。

実測でも、chosen event あたりの value of information は0.00329 score、95% lower bound 0.00288だった。

ただし、この event は自然な play で約0.208回/gameしか起きない。

現在の occupancy に掛けると、game-level では約0.07 percentage point/gameの prizeになる。

一方、以前の staged F0 model は atomic control に対して49.28%、つまり約0.72 point負けていた。

coarse-primary まで action contract を整理した後も、learnability の parity までは確認したが、search/self-play 後の strength gain はまだない。

このラインは将来の blind reserve 対応では意味がある。

blind reserve では非公開 card を引いた本人だけが identity を知り、その情報を見た後に cleanup を行う必要があるので、turn 内で decision を分けられる substrate は必要になる。

しかし、現時点の no-blind playing strength を伸ばす投資としては、measured prize が小さい。

そのため staged / coarse-primary / recourse は継続するが、現時点では no-blind の finished-player strength を伸ばす研究の主軸には置かない。post-refill information を使える action contract や blind-play capability を作る研究として進めつつ、strength 改善の主要な計算資源は self-play loop、target construction、data / update allocation へ振る。

## model capacityよりtraining targetの方が未検証だった

ここまでの実験で、model size を増やすべきという evidence は出ていない。

factorized encoder は validation cross-entropy を改善しても matched-time arena では強くならなかった。

supervised bootstrap も、capacity ceiling より optimization budget の影響が強かった。

一方、現在の self-play target の作り方には、まだ直接比較していない選択肢が多い。

policy target には、root noise の影響を補正した visit counts を使っている。

しかし以前の operator audit では、reference-Q regret が

| operator | regret |
| --- | ---: |
| corrected noisy visits | 0.0359 |
| raw noisy visits | 0.0167 |
| Gumbel target | 0.0059 |

だった。

これは古い network 上の fixed-state diagnostic なので、そのまま「raw visits の方が強い」とは言えない。

重要なのは、今使っている corrected visits と raw visits を、同じ corpus から model を再学習して downstream strength まで比較した実験がまだないことだ。

value target も同じで、現在の generation recipe は terminal win/draw/loss だけを使っている。

しかし self-play row には root search value も保存されている。

既存 corpus を変えず、

policy:
- corrected visit counts
- raw visit counts

value:
- terminal WDL only
- terminal WDL + searched value mix

の2×2で refit できる。

新しい self-play collection を回さず、label construction だけを分離して比較できるので、次の実験として費用対効果が高い。

これまで architecture や search contract を変える前に、まず learner が何を教師として見ているのかを調べる。

## 1世代のdata量とupdatesもまだ決まっていない

現在の recipe では、1 generation あたり約90,000 collected decisions から32,768 fresh rowsを残し、過去2世代の replay と混ぜて512 AdamW updatesを行う。

この32,768と512が十分なのかは、実はまともに sweep していない。

しかも warm-start なので、同じ新規 row は平均すると複数回 presentation される。

次に見るべきは、model width を増やすことではなく、

- 同じ data に対して updates を増やす
- updates が足りているなら fresh rows を32,768から65,536へ増やす
- その後で、同じ compute を「game数を増やす」のと「1 gameあたりの search simulationsを増やす」のどちらへ使うか比較する

という順序になる。

特に search budget を128から384や512へ変える場合、以前の PUCT parameter がそのまま最適とは限らない。

128 simulationsで得た `(0.75, 0.0)` を、別 budget に無条件で持ち込まない。

## 学習よりevaluationの方が高くついていた

systems 側を横断すると、別の偏りも見えた。

G4 learner-transfer では18 networksを作ったが、A100上の collection は合計2.34時間、fit は0.26時間程度だった。

対して evaluation arena はM2で4.87時間、その後の readout はさらに3時間かかった。

今の loop では、learner を1世代進める計算より「その世代が良かったかを詳しく診断する」方が重い。

CPU pipeline や arena search にはすでに大きな高速化を入れた。

arena selected-action early stop では loop generationを23.3%短縮し、CPU pipeline全体でも実 loop を16.6%短縮した。

ここから先、INT8やbf16 CPU fitのように numerical recipe 自体を変える最適化へ踏み込むより、毎 generation にどこまで詳細な diagnostics を走らせる必要があるのかを見直す方が効く。

普通の continuation generation は小さな frozen panel で追跡し、節目だけ大きな endpoint evaluation を行う。

評価コストも training budget の一部として設計する。

## 今後の研究プログラム

以上を踏まえて、当面の順番を次のように組み直した。

最初に frozen strength ladder を作る。

その裏で G5 以降の self-play generation は止めずに継続する。1世代の non-significant な結果で plateau と判断せず、複数 generation の傾向を見る。

次に、既存 corpus を使って policy / value target を refit 比較する。新しい data を作らず target construction の効果だけを切り分ける。

その後、updates を増やし、それでも改善するなら data quantity を増やす。

recipe が固まってから、同じ compute を game breadth と search depth のどちらへ配るべきか比較する。

終盤の threat state については、単に rare state を増やす前に「その敗戦は数手前の別 action で本当に救えたのか」を調べる。そのうえで start-state diversity が full-game strength へ transfer するかを見る。

そして BGA を最終目標にする以上、blind reserve を扱える learner stack の準備も並行して始める。

現在の training / search は no-blind Splendor なので、ここは単なる evaluation の不足ではなく、最終的に解かなければならない game contract の差である。

## 何をやらないかも決めた

研究計画を組み直すとき、「次にやること」だけでなく「今はやらないこと」がかなり明確になった。

`sml-puct-v5` のような追加の endgame exactness、enabling-move / noble-order heuristic、128 simulations 周辺の追加 PUCT grid は止める。

staged / coarse-primary / recourse は継続するが、no-blind strength 改善の主経路としては優先度を下げる。

CPU throughput の micro-optimization も、現在の bottleneck ではない。

validation CE、fixed-state operator metric、offline VOI だけで production adoption を決めることもしない。

これらは補助的な evidence にはなるが、最終的には search/self-play を通した downstream playing strength で判断する。

## 個別の改善から、学習系全体の改善へ

これまでの実験で、EAT の弱点をかなり細かく切り分けられるようになった。

search parameterを変えると frozen model の強さが動くことも分かった。self-play targetへその設定を移すと次世代 network も強くなった。終盤の具体的な search error も直せた。self-play がほとんど訪れない state を model-free に生成する基盤もできた。

一方、それらをまとめて見ると、次の大きな改善候補はさらに細い局所修正ではなかった。

今必要なのは、

「どの model が本当に前より強いかを安定して測る」
「同じ self-play loop を数世代継続して learning curve を得る」
「model に何を target として学ばせるかを直接比較する」
「data と optimization budget の限界を測る」

という、学習系の中心部分だった。

個別の技術課題を解く段階から、強さが継続的に伸びる研究プログラムそのものを設計する段階へ移った。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
