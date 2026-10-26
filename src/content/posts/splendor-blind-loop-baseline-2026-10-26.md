---
title: "blind-reserve対応後に48世代self-playしても強さはほぼ伸びなかった"
date: "2026-10-26T12:00:00+09:00"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

blind reserveを正式なゲームルールとして取り込んだあと、self-play学習がどのように進むのかを48世代分追った。

出発点は、no-blind時代のD系統から作ったblind-reserve対応bootstrapモデル n5_s1。ここからproduction設定のself-play loopを、seedだけ異なる2つのlineageで48世代ずつ回した。

結果として、対局強度は大きく伸びなかった。一方で、プレイスタイル、探索コスト、policyのsearch targetへの追従はかなり変化した。特にvalue headは、学習を続けてもheld-outでほぼ改善せず、終盤に比べて序盤ではsearch valueと最終勝敗の対応がかなり弱かった。

## 48世代回してもEloはほぼ横ばいだった

評価は、各actorを共通のpanel arenaで比較し、Bradley–Terry Eloへまとめた。

| 世代 | lineage A | lineage B |
| --- | ---: | ---: |
| 16 | +5 Elo [−9, +21] | −21 Elo [−35, −6] |
| 32 | +11 Elo [−4, +26] | +32 Elo [+18, +47] |
| 48 | +7 Elo [−7, +21] | n5_s1に54.5% [50.9, 58.1]、約+31 Elo |

lineage Bは最初の16世代で一度弱くなり、その後16世代で約+53 Elo回復したが、32世代以降はほぼ伸びなかった。

lineage Aは32世代まで明確な改善がなく、generation 34でproduction monitorがhaltした。追加800 pairのadjudicationでもregressionは確認できず、最終的にはrescue seriesとして別扱いにした。

同じrecipeでも、seedだけで最大26 Elo程度の差が出た。1 seedだけの比較では、treatment差とseed差を区別しにくいことも分かった。

## blind reserveは1%から10〜13%まで増えた

強さは大きく変わらなかったが、行動分布はかなり変わった。

blind reservationを選べるMAIN decisionのうち、実際にblind reserveを選ぶ割合はbootstrap直後の約1%から、48世代後には10〜13%まで増えた。

これは、bootstrap時点ではblind reserveにほぼ教師信号がなく、root noise経由でわずかに試すだけだった状態から、self-playを通じてpolicyがblind reserveを積極的に使うようになったことを示している。

固定局面で見ると、最終actorのtop choiceはn5_s1と40〜44%の局面で異なっていた。

つまり、strengthが横ばいでもpolicy自体は大きく変わっていた。

## policyはsearch targetへ近づいたが、valueは改善しなかった

never-trained holdoutでoffline指標も追った。

policy priorとsearch targetのKLは約0.37から0.24へ下がった。self-playを通して、policy headは自分自身のsearch targetへかなり近づいている。

一方で、value log-lossはほぼ横ばいだった。

さらに、各fitの前後でvalue predictionを比較すると、terminal outcomeに対してもsearch valueに対しても、held-outでは改善量がほぼゼロだった。

training中にはvalue lossが下がっていても、その改善が未知局面へ移っていない。

このため、今回のloopで起きている学習は、policy側には明確に見えるが、value generalizationにはほとんど現れていない。

## 序盤のsearch valueは最終勝敗をほとんど説明しなかった

局面を終局までの残りplyで分けると、value signalの性質も大きく違った。

終局40 ply以上前の局面では、search valueが最終outcomeのvarianceを説明する割合は約4%しかなかった。

一方、残り10 ply以内では64〜66%まで上がった。

終盤ではsearch valueがかなり結果を表すが、序盤では同じvalue targetを使っても、最終勝敗との対応が非常に弱い。

現在のvalue targetは、terminal outcomeとsearch valueを混ぜている。この結果を見ると、ゲーム全体で固定mixを使うより、phaseに応じてtargetの意味を変える方が自然かもしれない。

## blind playは探索コストも増やした

blind reserveが増えるにつれて、belief search側の計算量も大きく増えた。

1回のMAIN searchあたりのmodel simulation数は、bootstrap直後の約9.4回から62〜77回まで増えた。root simulations自体は128で固定しているため、blind informationを扱う内部simulationが追加で増えた形になる。

その結果、1世代あたりのself-play時間は1.9〜2.4倍まで伸びた。

単純に48世代回しただけでも、policyがblind reserveを多用するようになることで、同じsearch settingの実効計算量が変わっていくことが分かった。

## 強くならないのにプレイだけ変わる

全43,200 study-arena gamesを再解析すると、最終actorではblind reserveが1 gameあたり2.1〜2.9回まで増え、tier 1の購入やnoble獲得は減っていた。

一部のmatchupでは、このstyle driftが負けと関連していた。

さらにsearch側を見ると、concealed cardを持つ側のsearch valueが実際のoutcomeより0.03〜0.05程度高くなる傾向があった。non-opening root visitsの42〜45%はexploration noise由来だった。

ここから、network単体よりもteacher search側のbiasが次世代のpolicyへ伝わっている可能性が出てきた。

まだ因果関係は確定していないが、48世代という長いloopで「policyは教師へ近づくのにstrengthは伸びない」という結果と合わせると、teacher targetそのものを再点検する必要がある。

## 今回のbaselineが示したこと

blind-reserve導入後のself-playでは、少なくとも今回のrecipeでは48世代回しても大きなstrength gainは得られなかった。

一方で、

- blind reserveの使用率は1%から10〜13%へ増えた
- policy KLは0.37から0.24へ改善した
- valueのheld-out改善はほぼゼロだった
- early-gameのsearch valueはoutcome varianceを約4%しか説明しなかった
- blind playの増加でsearch costは約2倍になった
- seed差は最大26 Elo程度あった

という学習上の特徴が見えた。

次の実験では、単に世代数を増やすより、blind reserve時のteacher search、value targetのphase依存性、concealmentに応じたvalue label、structured featureなどを個別に検証する方が情報量が高そうだ。

48世代のbaselineを作ったことで、blind-reserve対応後の「ただself-playを続けた場合」の挙動がようやく基準として固定できた。

---

この記事は、実装・実験記録をもとに、主にLLMが編集しています。
