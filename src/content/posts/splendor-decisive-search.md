---
title: "Splendor AIのPUCTで即勝ちを厳密に扱ったら、終盤の誤探索が+0.82pt改善した"
date: "2026-09-29"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を作っている。前回、G3 という self-play 済みモデル群の4,608局を手ごとに再生し、終盤の負け方を調べた。その中で、探索器側の問題だと切り分けられた失敗があった。

相手に次の1手で勝てる reply があるのに、その手の policy prior が低いため PUCT が一度も訪問せず、network の楽観的な value を信じたまま別の手を選んでしまう。今回は、この「1手先で勝敗が確定する局面」だけを neural network に推測させず、ゲーム engine で厳密に判定するようにした。3つの G3 model を point rush / reserve anchor と対戦させた2,304局では、修正前に対して +0.82 percentage points、95%区間 [+0.37, +1.28] だった。

24局が loss から gain 側へ動き、5局が逆方向へ動いた。探索時間の差は、終盤336局面の固定ベンチマークで +0.6% と測定ノイズに近い範囲だった。

## 原因はtie-breakの特徴量不足ではなかった

前回の分析では、G3 に次のような失敗が見つかっていた。

- 相手が reserve に持っている勝ち札を止めず、そのまま次の手で負ける
- 15 prestige で同点にしても card-count tie-break で負ける局面を高く評価する
- 自分に即勝ちがあるのに、別の手を選ぶ

最初に確認したのは、これが model input や label の欠陥ではないかという点だった。Splendor では同じ prestige でゲームが終了した場合、購入した development card が少ない側が勝つ。この tie-break 自体は native engine の terminal 判定に入っていた。

購入カード枚数も model input から復元でき、value label も engine が決めた winner から作られていた。terminal rule と必要な feature / label は実装されていたが、PUCT がその terminal state まで到達していなかった。

## 低priorの即勝ちreplyが128 simulationsでも訪問されない

G3 の arena では PUCT を128 simulations回している。当時の設定は、

- `c_puct = 1.5`
- `fpu_reduction = 0.25`
- root noise なし
- temperature 0

だった。PUCT は policy network の prior が高い候補を優先して探索する。未訪問の手には first-play urgency として既存 value より少し低い値が置かれるため、prior が十分小さい候補は128 simulationsでも一度も選ばれないことがある。

実際の失敗例では、相手の即勝ち reply の prior を0.01程度とすると、root visit が110付近でも exploration bonus は約0.16だった。一方、未訪問候補には `fpu_reduction = 0.25` の不利がある。このため、その reply は一度も訪問されず、親側の「相手に勝ち筋を渡す手」は network が出した Q 0.89〜0.99 のまま残っていた。

探索の深さが足りないというより、「確定している terminal outcome へ到達する前に prior で枝が切られている」状態だった。

## terminal outcomeだけはnetworkに推測させない

修正では、search node を展開した時点で合法候補を調べる。その手を選ぶとゲームが終了し、現在の actor が単独 winner になる候補があれば、その node を decisive と扱う。この判定は heuristic ではなく、既存の native transition と terminal adjudication をそのまま使う。

無関係な候補まで全て transition するコストを避けるため、まず prestige の上限で明らかに勝てない候補を落とし、残りだけ engine で確認する。decisive node では、

- winning candidate を prior に関係なく選ぶ
- node value を network 出力ではなく厳密な +1 とする
- その node へ到達する相手側からは −1 として backup する

ようにした。これにより、相手の即勝ち reply が policy prior でほぼ消えていても、一度その親 action を調べれば「この手は次に確定で負ける」と分かる。自分の root に即勝ちがある場合も同じで、prior が低くても必ずその手を取る。

この変更は PUCT の selection / backup / policy target を変えるため、search contract も `sml-puct-v2` から `sml-puct-v3` に更新した。

## 同じG3、同じ128 simulationsで比較した

修正の効果だけを見るため、model weights と search budget は固定した。使った G3 は、self-play を3世代進めた3つの独立 lineage である。対戦相手は2種類の rule-based agent を使った。

- point rush: engine 構築より短い手数で prestige を伸ばし、15点到達を急ぐ heuristic agent
- reserve anchor: 強い development card を reserve に保持し、そのカードを買える状態へ近づく action を優先する heuristic agent

どちらも学習済み network ではなく、手作りのルールで行動する baseline である。3 G3 tracks × 2 opponents × 192 paired starts × 2 seat orientations で、修正版は2,304 gamesを走らせた。control は過去に保存していた v2 の arena cell を使ったが、まず G3-1701 × point rush の384 gamesを当時の base build で再実行し、384/384すべての start、seed、seat、result、decision count が一致することを確認した。

そのため、残りの retained cells も control として再利用できた。

## +0.82pt改善した

v3 − v2 の paired score difference は次の通りだった。

| opponent | difference | 95% CI |
| --- | ---: | ---: |
| point rush | +1.04 pt | [+0.36, +1.72] |
| reserve anchor | +0.61 pt | [−0.01, +1.22] |
| equal-weight primary | +0.82 pt | [+0.37, +1.28] |

2,304 gamesのうち、結果または decision count が変わったのは87局だった。最終結果が変わったのは29局で、24局が修正版に有利、5局が不利だった。net では19勝増えている。

修正対象が終盤の一部だけなので、効果量は大きくない。それでも、model weights も simulation budget も変えず、確定 terminal outcome の扱いだけを変えた比較で区間全体が0より上になった。

## 実際にどう変わったか

point rush 戦のある局面では、G3 は13 prestigeだった。card 56 を買えば15点に到達できるため、v2 は128 simulations中111 visitsをその購入へ使い、Qを0.89と評価していた。

しかし、その購入後には point rush が card 88 を買って勝てる。v2 では card 88 の reply が十分探索されず、その terminal loss が親へ返ってこなかった。v3 では相手側の即勝ちを engine で認識するため、card 56 の Q は −1 になる。

代わりに相手の勝ち札である card 88 を reserve する手へ123 visitsが集まり、その arena game は loss から win に変わった。別の teacher 戦では逆に、G3 自身に card-count tie-break で即勝ちできる購入があった。v2 はその手を選ばなかったが、v3 は15 prestige、購入カード19枚対21枚という terminal win を厳密判定し、その手へ128/128 visitsを集めた。

search budget を増やさず、terminal rule の exact adjudication でこの failure を解消した。

## 修正対象外の終盤ミスは残った

前回調べた652敗の ply 40以降、5,825 turnsを v2 / v3 の両方で再検索すると、selection が変わったのは97 turnsだった。そのうち23 turnsでは、v2 が選んでいた手が v3 では厳密に −1 と判定された。

一方、4,629 turns、79%は search result が同一だった。equal-prestige の最終戦績も、point rush / reserve anchor 合計で v2 の0勝34敗から v3 の0勝36敗となり、集計値自体は改善していない。3件の tie-break loss は win に変わったが、別の prestige loss が tie-break loss に移ったためである。

この修正が扱うのは「次の1手で engine が勝敗を確定できる」範囲だけだ。相手が starting seat で勝ちまで2 plies必要な threat や、tier-3 card と noble を組み合わせた数手先の surge は、依然として policy prior と learned value に依存する。

前回見つかった value head の終盤での楽観性も、そのまま残っている。

## searchの仕事とnetworkの仕事を分けた

終盤の弱点を training data だけに帰属させず、engine / feature / label / search を切り分けた。engine / feature / label を確認した後、残った failure の一部は PUCT が exact terminal reply を訪問しないことに起因すると切り分けた。terminal outcome は model に近似させる必要がない。

engine が厳密に答えられる場所では、その答えを search に直接使う。そのうえで、まだ残る2-ply threat や value miscalibration は学習側の問題として別に測る。終盤の失敗を「探索を増やす」「特徴量を増やす」と一括りにせず、どの層で情報が失われているかを切り分けられた。

なお、この v3 の exactness はその後さらに拡張され、final decision 全体を厳密に解く search contract へ進んでいる。ここでは、その最初の修正である「即勝ちを prior に依存せず扱う」変更と実測結果に絞った。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
