---
title: "Splendor AIのvalue教師を継続対局で測ったが、8回平均は現行モデルを上回らなかった"
date: "2026-08-20"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "value"]
---

Splendor をプレイする policy-value model を、PUCT というゲーム木探索と自己対局で改善している。

Splendor は宝石を集めてカードを買い、買ったカードを次の購入の割引として使いながら15点以上を目指すゲームだ。value は、ある局面から最終的に loss / draw / win のどれになりそうかを予測する。

これまでの学習では、1ゲームの最終結果を、そのゲーム中の各局面の value target として使っていた。1ゲームに約58 decisionあるので、同じ win / draw / loss が多数の異なる局面に付く。

これは間違った target ではない。ただし1回の対局結果には運やその後の手順による揺らぎがあり、同じ episode の target 同士も強く相関している。長く学習した実験では、value head が精度を大きく失う前に過剰に自信を持つ方向へ悪化した。

そこで今回は、同じ局面から何度も続きをプレイし、その局面の勝敗分布を直接測ってみた。

## 同じ局面から16回続きをプレイする

ある公開局面を固定し、現在のモデル同士をその局面から16回対局させる。探索条件は毎回同じ PUCT 32 simulations で、episode seed だけを変える。

例えば16回の結果が

```text
loss  5
 draw  1
  win 10
```

なら、その局面の経験的な WDL 分布は

$$
[5/16, 1/16, 10/16]
$$

になる。

これをそのまま新しい教師にする前に、まず「8回程度の継続対局から作った分布は、現在のモデルより良い予測器なのか」を測ることにした。

16 outcomes を8回ずつの A と B に分ける。A 側の8回平均を $y_A$、B 側を $y_B$、現在のモデルの WDL 予測を $M(s)$ とする。

各 state について、

$$
D(s)=\operatorname{Brier}(M(s), y_B)-\operatorname{Brier}(y_A, y_B)
$$

を計算した。

$D(s)>0$ なら、8回の continuation mean の方が現在のモデルより、独立な残り8回をうまく予測していることになる。

## 最初の512 state pilotには問題があった

最初は512 statesから16回ずつ、合計8,192 gamesを実行した。

結果は `mean(D) = -0.00808`、one-sided 95% lower bound は `-0.02052` で、事前に決めていた「0より大きい」という条件を満たさなかった。

ただし、実験後の監査でさらに重要な問題が見つかった。

512 states のうち459 statesが、現在のモデルを学習した train split に含まれていた。

continuation の対局結果自体は新しく生成していても、モデルは入力となる state を学習時にすでに見ている。したがって、この結果を unseen state に対する独立評価として扱うことはできない。

「seed を何千個変えて fresh game を作る」だけでは、state population が training data と重なっている問題は消えない。

この pilot は on-support の診断としては残したが、一般化についての結論には使わないことにした。

## test splitだけでやり直した

次に、もともとの group split で test に割り当てられていた195 statesだけを使って同じ測定をやり直した。

train / validation の state と exact public-state key が重ならないこと、source group が重ならないことを対局前に確認した。さらに、以前の supervised warm-start data との exact key overlap も0だった。

195 states × 16 continuations なので、合計3,120 gamesになる。

ただし統計上の独立な単位は3,120 gamesではなく195 statesである。同じ state からの16 outcomesは、その state の分布を推定するための replicate として扱った。

結果は次の通りだった。

| 指標 | 結果 |
| --- | ---: |
| independent states | 195 |
| outcomes per state | 16 |
| total games | 3,120 |
| `mean(D)` | -0.01627 |
| one-sided 95% lower bound | -0.03631 |
| 判定 | stop |

holdout でやり直しても、8回 continuation mean が現在のモデルを上回るという証拠は出なかった。

現在のモデル自身は16-outcome meanに対して Brier 0.06477、cross-entropy 0.59649、scalar MAE 0.27410だった。

## 単純な calibration の問題でもなさそうだった

value logits の自信が強すぎるだけなら、temperature scaling で改善する可能性もある。

195 states を fit/eval に分けた diagnostic では最適 temperature は1.0065だった。cross-entropy は0.60447から0.60420、Brier は0.06932から0.06926へ変わっただけだった。

ほぼ1なので、単純に logits 全体を縮めれば解決する問題には見えなかった。

また loss / draw / win の class order や、どちらのplayer視点で value を作るかについても mapping を再確認したが、反転バグは見つからなかった。

## 近い終局だけは少し違う傾向もあった

事後的に残り decision 数で分けると、`D` の平均は

```text
1-8 decisions     +0.0354
9-16 decisions    +0.0328
17-32 decisions   -0.0220
33+ decisions     -0.0449
```

だった。

終局に近い state では continuation mean が良さそうに見える一方、長い horizon では現在のモデル側が良かった。

ただしこれは事前に判定条件として決めた分割ではない。今回使った holdout を見た後で「終盤だけならいけそう」と条件を変えると、同じデータに合わせて仮説を作ることになる。

そのため、この結果から終盤専用 target を採用したり、同じ holdout で再試行したりはしない。

## 実験用のstate読込にもバグが見つかった

今回の exact-state experiment を作る途中で、Arrow の sliced struct を C++ へ戻すコードに offset の扱い漏れも見つかった。

非zero offset の slice を decode すると、本来の selected row ではなく先頭側の row を読む場合があった。修正前は512 statesを選んだはずなのに、model logits が4種類しか出ないという異常から発見した。

parent struct と nested player struct の offset を反映するよう修正し、nonzero slice の regression test を追加した。

これは今回新しく作った sliced-state preparation path の問題で、以前の8-epoch value overfit 実験には影響しない。

## 今回はcontinuation targetを採用しない

今回試したかったのは、「1回の hard WDL より、同じ state から8回続きをプレイした平均の方が value teacher として安定するのではないか」という仮説だった。

replication は target variance を下げる。しかし cross-entropy の期待勾配という意味では、1回の sampled WDL と複数回平均した WDL は同じ population optimum を持つ。複数回対局する価値は、有限データでのノイズや memorization をどれだけ減らせるかにある。

今回の independent holdout では、その R=8 variance reduction が現在のモデルを上回るほど有効だとは確認できなかった。

そのため、大規模な continuation data 生成、value head の再学習、production target の変更はここで止めた。

一方で、「1 episode の結果を多数の decision に複製している」という依存構造そのものは残っている。今回の結果は terminal WDL が常に最良だという意味ではなく、この actor、この state distribution、この replication 数では continuation mean を優先する根拠がなかった、という範囲に限定している。

今回一番大きかったのは、value target を変更する前に simulator で state-conditional outcome を直接測れたことと、fresh seed の数ではなく state-level holdout が必要だと実験で確認できたことだった。

---

この記事は、実装・実験記録をもとに筆者とAIが共同編集しています。
