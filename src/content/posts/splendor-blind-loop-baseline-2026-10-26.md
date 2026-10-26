---
title: "blind-reserve対応後に48世代self-playしても強さはほぼ伸びなかった"
date: "2026-10-26T12:00:00+09:00"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

blind reserveを正式ルールとして組み込んだあと、self-play学習がどう進むのかを48世代にわたって追跡した。

出発点は、no-blind時代のD系統から構築したblind-reserve対応bootstrapモデルn5_s1である。ここからproduction設定のself-play loopを、乱数seedのみ異なる2つのlineageで48世代ずつ実行した。

結果として、対局強度は大きく伸びなかった。一方でプレイスタイルや探索コスト、policyのsearch targetへの追従には顕著な変化が見られた。特にvalue headは、学習を継続してもheld-outデータでの改善がほぼ見られず、終盤に比べて序盤ではsearch valueと最終勝敗の対応が極めて弱かった。

## 48世代回してもEloはほぼ横ばいだった

各actorの評価は、共通のpanel arenaにおける対局結果をもとにBradley–Terry Eloで算出した。

| 世代 | lineage A | lineage B |
| --- | ---: | ---: |
| 16 | +5 Elo [−9, +21] | −21 Elo [−35, −6] |
| 32 | +11 Elo [−4, +26] | +32 Elo [+18, +47] |
| 48 | +7 Elo [−7, +21] | n5_s1に54.5% [50.9, 58.1]、約+31 Elo |

lineage Bは最初の16世代で一度弱体化したあと、続く16世代で約+53 Elo回復したものの、32世代以降は伸び悩んだ。

lineage Aは32世代まで明確な改善がなく、第34世代でproduction monitorにより停止した。追加で800ペアを判定しても性能低下（regression）は確認されず、最終的にはrescue seriesとして別枠で扱った。

同じrecipeを用いても、乱数seedの違いだけで最大26 Elo程度の開きが出た。単一seedによる比較では、施策の差（treatment差）とseedによる振れ幅を区別しにくいことも浮き彫りになった。

## blind reserveの選択率は1%から10〜13%へ増加した

強さは横ばいにとどまったが、行動分布は大きく変化した。blind reserveを選べるMAIN decisionにおいて、実際にblind reserveを選択する割合は、bootstrap直後の約1%から48世代後には10〜13%まで増加した。

bootstrap時点ではblind reserveに対する教師信号がほぼ存在せず、rootノイズ経由でわずかに試行される程度だった。それがself-playの蓄積に伴い、policyが自発的にblind reserveを採用するようになったことを示している。固定局面で評価すると、最終actorの第一候補手はn5_s1と40〜44%の局面で異なっており、実力が横ばいであっても着手方針自体は大きく変貌していた。

## policyはsearch targetへ追従したがvalueは汎化しなかった

学習に使っていないholdoutデータでオフライン指標の推移も確認した。

policy priorとsearch targetのKLダイバージェンスは約0.37から0.24へ低下した。self-playの反復を通じて、policy headが自身のsearch targetへと着実に追従している様子がうかがえる。

一方で、value log-lossはほぼ横ばいだった。各fitの前後でvalue予測を比較しても、終局結果（terminal outcome）とsearch valueの双方に対して、held-outでの改善量は実質的にゼロだった。学習データ上ではvalue lossが低下していても、その改善が未知局面への汎化に結びついていない。今回のループで生じた学習効果は、policy側には明確に現れたものの、valueの汎化性能にはほとんど反映されなかった。

## 序盤のsearch valueは最終勝敗をほとんど説明しない

局面を終局までの残り手番数（ply）で分類すると、value信号の性質に大きな違いがあった。

終局から40 ply以上離れた序盤局面では、search valueが最終結果の分散を説明する割合は約4%にすぎない。一方、残り10 ply以内の終盤では64〜66%まで上昇した。終盤のsearch valueは最終勝敗を色濃く反映するのに対し、序盤では同じvalue targetを参照していても勝敗との対応関係が極めて希薄である。

現在の設計では、terminal outcomeとsearch valueを一定割合で混合したvalue targetを用いている。この結果を見る限り、対局全体で一律の混合比率を適用するよりも、進行フェーズに応じてtargetの構成を切り替える方が理にかなっている可能性がある。

## blind playの定着により探索計算量が増加した

blind reserveの採用頻度が高まるにつれて、belief search側の計算負荷も大幅に増大した。

1回のMAIN searchあたりに要するモデルシミュレーション回数は、bootstrap直後の約9.4回から62〜77回へと跳ね上がった。root simulations自体は128に固定しているため、非公開情報を扱うための内部シミュレーションが追加で発生した格好である。

その結果、1世代あたりのself-play所要時間は1.9〜2.4倍に延びた。同一の探索設定であっても、policyがblind reserveを多用する行動様式へ移行するだけで、実行上の計算コストが大きく変動することが確かめられた。

## 実力向上を伴わないプレイスタイルの変容

全43,200対局のstudy arenaを再解析したところ、最終actorでは1対局あたりのblind reserveが2.1〜2.9回まで増える一方、tier 1カードの購入や貴族タイル（noble）の獲得頻度は減少していた。一部のマッチアップでは、こうしたプレイスタイルの偏り（style drift）が敗因と結びついていた。

さらに探索の内訳を調べると、裏向きカード（concealed card）を保持している側のsearch valueが、実際の終局結果よりも0.03〜0.05ほど上振れる傾向が確認された。また、初手以外のroot visitsのうち42〜45%は探索ノイズに起因していた。

このことから、ニューラルネットワーク単体の問題というより、教師役となるsearch側のバイアスが次世代のpolicyへと引き継がれている可能性が浮上した。因果関係の確定には至っていないものの、48世代を重ねても「policyが教師に近づくだけで実力は向上しない」という結果を踏まえると、teacher target自体の設計を再点検する必要がある。

## 今回のベースラインから得られた知見

blind-reserveを組み込んだself-playでは、少なくとも今回の実験設定において、48世代を回しても実質的な勝率向上は得られなかった。

得られた挙動の特徴は次の通りである。

- blind reserveの選択率は1%から10〜13%へ増加した
- policyのKLダイバージェンスは0.37から0.24へ改善した
- held-out局面に対するvalue予測の改善はほぼ皆無だった
- 序盤局面のsearch valueが結果の分散を説明する割合は約4%にとどまった
- blind playの増加に伴い、探索コストは約2倍に膨らんだ
- 乱数seedの違いだけで最大26 Eloの性能差が生じた

今後の検証では、単に世代数を重ねるのではなく、blind reserve選択時のteacher searchの挙動、ゲーム局面に応じたvalue targetの動的配分、裏向きカードの保持状態を考慮したvalueラベルの設計などを個別に検証するアプローチが有効と考えられる。

48世代にわたるベースラインを整備したことで、blind-reserve対応後に「通常のself-playを継続した場合の基準挙動」を明確に固定できた。

---

この記事は、実装・実験記録をもとに、主にLLMが編集しています。
