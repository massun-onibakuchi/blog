---
title: "blind reserveを禁止するとB48の対局スコアが7.4pt下がった"
date: "2026-10-26T19:15:00+09:00"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "search"]
---

前回、blind-reserve対応後のself-playを48世代回したところ、最終モデルB48はblind reserveをかなり多く使うようになった一方、対局強度は大きく伸びなかった。さらに、blind reserveの多い対局ほど負けやすいという相関も見えていた。

ただし、相関だけでは「blind reserve自体が悪い」のか、「苦しい局面でblind reserveを選んでいるだけ」なのか分からない。

そこで今回は、B48のnetworkとPUCT-128をそのまま使い、B48側の合法手からblind reserveだけを取り除いたarenaを作った。相手はbootstrapモデルのn5_s1。blind reserve以外のsearch、value、policyは変えていない。

結果は逆だった。blind reserveを禁止すると、B48の対局スコアは7.4ポイント下がった。

## 同じB48からblind reserveだけを消した

比較したのは次の2条件である。

| 条件 | B48のscore vs n5_s1 |
| --- | ---: |
| 通常のB48 | 54.5% |
| blind reserveを禁止したB48 | 47.1% |

差は−7.4ポイントで、95%信頼区間は−11.5〜−3.3ポイントだった。

mask側は1,200 seat-swapped pairs、通常側は以前のbaselineで使った400 pairsを参照した。

最初の400 startsは両条件で同じstart coordinateとepisode seedを使っている。そのprefix-paired比較でも差は−6.3ポイント［−10.7〜−1.8］だった。

maskしたB48はstarting seatで48.8%、second seatで45.4%。通常のB48は56.6% / 52.4%で、両seatとも低下した。

## blind reserveを消すと、主にface-up reserveへ置き換わった

maskが本当にblind reserveだけを除いているかもnative replayで確認した。

2,400 gamesで、masked playerのblind reservationは0件だった。

一方、通常のB48は1 gameあたり平均2.43回blind reserveし、4.16回face-up reserveしていた。blind reserveを禁止すると、face-up reserveは6.38回まで増えた。

つまりreserveそのものをしなくなったわけではない。blind reserveの代わりに、主に公開カードのreserveへ置き換わった。

gold intakeも大きくは変わっていない。blind reserveの価値を単純に「gold tokenを取れるから」とだけ説明するのは難しい。

## 「blind reserveが多いほど負ける」は因果ではなかった

前回のplay analysisでは、matchup内でblind reserveが増えることと負けが関連していた。

もしblind reserve自体が悪手なら、blind reserveを禁止したB48は強くなるはずだった。

実際には逆で、7.4ポイント下がった。

少なくともB48 vs n5_s1という今回の条件では、blind reserveは全体としてB48の強さに寄与していた。

前回見えていた負の相関は、「blind reserveを選ぶから負ける」というより、blind reserveを選びたくなる局面自体が難しい、というselection effectを含んでいた可能性が高い。

## concealed cardのvalue biasとは別の問題だった

前回の分析では、blind reserveでconcealed cardを持っている側のsearch valueが、実際のoutcomeより0.03〜0.05程度高い傾向も見つかっていた。

ここから「blind reserveを過大評価しているため、使いすぎて弱くなっているのではないか」という仮説があった。

今回のmask実験では、その解釈はそのままでは成り立たなかった。

search valueにcalibration biasがあったとしても、blind reserveというmove全体を取り除くと弱くなる。つまり、

- concealed cardのvalue estimateにbiasがあること
- blind reserveという行動自体が有効かどうか

は分けて考える必要がある。

value calibrationの問題が存在しても、blind reserve自体はnetで有益になりうる。

## 実験上の注意点

今回の通常B48は、以前のbaseline panelを再利用している。mask側はKaggle T4、通常側はColab L4で、どちらもTensorRT FP32だった。

そのため、host差が完全にゼロだと直接確認した比較ではない。

観測差は7.4ポイント、95%信頼区間の上端でも−3.3ポイントなので、host差が3.3ポイントを超えるほど大きければ結論は崩れる。この点は今回の比較の制約として残る。

また、今回確認したのはB48 vs n5_s1だけであり、他世代、他lineage、他opponentでも同じblind reserveの価値があるとは限らない。

## 次に見るべきもの

今回の結果で、blind reserveを丸ごと弱点として扱う理由は薄くなった。

次に重要なのは、blind reserveを使うかどうかではなく、

- どの局面でblind reserveのgainが大きいか
- concealment時のsearch value biasが着手順位へどう影響するか
- blind reserveのtierやgame phaseで価値が変わるか
- belief searchがhidden informationをどこまで正しく評価できているか

を局面単位で調べることになる。

blind-reserve対応後の48世代loopでは、blind reserveが1%から10〜13%まで増えた。その増加を単なる悪いstyle driftと解釈するのではなく、少なくとも一部はモデルが実際に有効な行動を学んだ結果だと考えられるようになった。

---

この記事は、実装・実験記録をもとに、主にLLMが編集しています。
