---
title: "自己対局の世代ごとにAdamWをリセットするのをやめた"
date: "2026-10-06T07:45:00+09:00"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

Splendor AIでは、自己対局でデータを集め、学習して次のモデルを作る、という世代更新を繰り返している。現在のUモデルでは1世代につき512回のoptimizer updateを行う。

調べてみると、この世代境界でモデルの重みだけを次世代へ引き継ぎ、AdamWの内部状態は毎回初期化していた。AdamWが保持する一次・二次モーメントやparameterごとのstep countが消えるため、同じ学習を継続しているように見えても、optimizerとしては512 updatesごとに再スタートしていた。

この挙動に機械学習上の根拠はなく、以前の実装をUへ引き継いだ結果だった。そこで、AdamWを毎世代リセットするRと、完全なoptimizer stateを継続するCを、過去のU2からU8までのデータを固定して比較した。

## リセット直後だけ学習が大きく乱れていた

両armには同じデータを同じ順番で与え、違いをoptimizer stateの継続だけにした。

世代開始直後のtraining lossには明確な差が出た。

| update区間 | R − C のtraining loss |
| --- | --- |
| 1–32 | +0.023〜+0.038 |
| 33–64 | +0.001〜+0.004 |
| 65–128 | おおむね0〜+0.002 |
| 449–512 | ほぼ0 |

AdamWをリセットしたRでは、各世代の最初の32 updatesでlossが2〜4%程度高くなった。最初の8 updatesでのparameter displacementも、Cの0.10〜0.12に対してRは0.20〜0.23で、約1.8〜2.3倍だった。

AdamWは勾配の一次・二次モーメントを使ってupdate量を調整する。毎世代それを捨てると、世代開始直後は成熟したpreconditionerがなくなり、重みが一時的に大きく動く。今回の測定では、その乱れの大半はupdate 64あたりまでに自然に消えた。

## 最終的なfitと対局強度にはほとんど差がなかった

初期の学習挙動は違ったが、512 updatesを終えた時点では差はかなり小さかった。

| 指標 | C − R |
| --- | ---: |
| joint offline metric | +0.18% |
| MAIN policy KL | +0.33% |
| CLEANUP policy KL | +0.07% |
| terminal WDL log loss | −0.01% |

事前に設定したharm marginはいずれも超えなかった。

最後にC-U8とR-U8を1,200組、合計2,400局で対戦させた。Cのpair scoreは49.92%、95%区間は47.92〜51.91%だった。

つまり、optimizer stateを継続しても強くなったとは言えない。一方で、3ポイント以上弱くなる可能性はこの評価では除外でき、継続によるmaterialな悪化も確認されなかった。

## 強さではなく、学習ループの意味を揃えるために変更した

今回AdamW continuationを採用した理由は、対局勝率の改善ではない。

自己対局の1 lineageを継続学習として扱うなら、世代境界だけを特別なoptimizer初期化点にする理由がない。しかもresetを残すと、1世代あたりのupdate数を変えたときに「optimizerを何回リセットするか」まで同時に変わってしまう。

たとえば512 updatesごとにresetする現在の条件と、256 updatesごとに世代更新する条件を比較すると、後者では同じ総update数でもreset shockが2倍の頻度で入る。これではgeneration cadenceや学習量を調べる実験に、optimizer再初期化という別の変数が混ざる。

そのため新しいself-play loopでは、親モデルの重みに加えてAdamWのfirst moment、second moment、step countも次世代へ引き継ぐようにした。子世代のlearning rateやweight decayは子側の設定を使い、親checkpointそのものを書き換えないようstateをcloneする。

Uモデルへ最初に移行したrootには互換なoptimizer stateが存在しないため、lineageの最初の1回だけはfresh AdamWから始まる。その後の世代では一つのoptimizer trajectoryとして継続する。

今回の結果は、世代ごとのAdamW resetがU8の強さの停滞原因だった、というものではなかった。むしろ、resetは毎世代小さな学習ショックを発生させていたが、512 updatesあればほぼ回復していた。

それでも、この不要な境界を取り除いたことで、今後generation length、update budget、policy targetなどを比較するときに、optimizer resetを隠れた交絡要因として抱えずに済むようになった。

---

この記事は、実装・実験記録をもとに、本文の編集を主にLLMが行い、筆者が内容を確認・修正しています。
