---
title: "終盤だけ探索を深くすると、まだ大きな取りこぼしが見つかった"
date: "2026-10-08T21:30:00+09:00"
isPublished: true
lang: ja
tags: ["splendor", "search", "machine-learning"]
---

v8のself-play loopを8世代回したあと、現在もっとも強い系統の一つになっているFでも、終盤に探索不足が残っているのかを調べた。

Fは、raw MAIN policy targetを採用したU系統をさらにself-playで育てたgeneration 7のactorである。通常の対局ではMAINを128 simulationsのPUCTで読む。この128というbudgetでもかなり強くなったが、終盤の一部だけさらに深く探索すれば、まだ修正できる判断が残っているかもしれない。

そこで今回はproduction設定を変える前に、固定されたFの対局ログを使って128 simulationsと2,048 simulationsを比較した。

結果として、終盤ではまだかなりの判断が変わった。ただし「相手がもうすぐ15点」という分かりやすい危険局面より、探索木のvisitとQ値が食い違っている局面の方が、深掘りする場所としては有望だった。

## 300局から終盤のrootを再探索した

F同士のself-playを300局生成し、ply 36以降のすべてのMAIN root 6,190件と、それ以前のrootの15%を保存した。

それぞれについて、

- 128 simulations
- 2,048 simulations

で同じ局面をもう一度探索し、選ぶ手が変わるかを調べた。

まず実験系が元の探索を再現できているかを確認したところ、128 simulationsの再探索は100件中100件で元対局の着手とvisit countを完全に再現した。continuation側も60件中60件で元の対局を再現できた。

そのうえで、ply 40以降で2,048 simulationsによって選択が変わったrootから250件を無作為抽出し、元の128側の手と2,048側の手をそれぞれ64回ずつ、common random numbersを使ったpaired continuationで評価した。

## 終盤では27%の判断が変わった

ply 36以降では、2,048 simulationsに増やすと27%のdecisionで選択が変わった。

ただし、探索を同じ128または2,048 simulationsで別seedからやり直しただけでも約11%は手が変わる。したがって27%すべてを「探索深度で修正された判断」とみなすことはできない。11%程度は探索ノイズのfloorとして存在する。

それでも、実際に深い探索で変更された手をcontinuationで評価すると差は大きかった。

| 項目 | 結果 |
| --- | ---: |
| ply 36以降で2,048が着手を変更 | 27% |
| 同budgetをre-seedしたときの変更率 | 11% |
| outcome評価したchanged roots | 250 |
| 1 rootあたりのpaired continuations | 64 |
| 2,048側の手の平均改善 | +5.2pt |
| 95% CI | +3.1〜+7.4pt |

深い探索によって変更された着手は、元の128 simulationsの着手に対して平均で+5.2 percentage pointsのscore改善を持っていた。

この改善はply 40から56までの各帯で正だった。ply 56を超えると、そもそも深い探索で手が変わる割合自体が14%まで下がった。

これは「Fが終盤全般で弱い」という意味ではない。固定されたrootの中で、深い探索によって着手が変わったケースを条件付きで評価した結果である。それでも、128 simulationsでは取りこぼしている有効な着手がまだ残っていることは分かった。

## 「相手が15点圏内」は良いtriggerではなかった

最初に考えていた分かりやすいtriggerは、相手が次の数手で15点へ届きそうな局面だった。

Splendorでは終盤のtempoが非常に重要なので、相手が勝利圏内に入ったら探索budgetを増やす、という設計は自然に見える。

ところが実際には、この条件はあまり当たらなかった。

相手がreach状態にあるrootで2,048 simulationsが着手を変えた割合は9.6%。それ以外では29%だった。

さらに、reach状態はlate root全体の13%を占める一方、深い探索で得られたbenefitのうち3.6%しか担っていなかった。

少なくともFでは、「相手がもうすぐ勝ちそうだから深く読む」というルールは、探索budgetを重点配分する指標としては弱かった。

## visitとQ値が食い違う局面に78%のbenefitが集中した

一方で、かなり強いsignalになったのがvisit–value disagreementだった。

128 simulationsの探索後に、

「もっともvisitされたchild」と「十分にvisitされたchildの中でもっともQが高いもの」

が一致しないrootをUNSTと呼ぶことにした。

このUNSTはlate rootの28%しかなかったが、深い探索によるbenefitの78%がここに集中していた。

| rootの種類 | changed actionの平均改善 |
| --- | ---: |
| UNST | +7.9pt |
| 非UNST | +2.3pt |

つまり、128 simulationsを終えた時点で「探索量はAを支持しているが、valueはBを支持している」という内部矛盾が残っている局面ほど、そのまま探索を続ける価値が高かった。

これは外部のgame-state heuristicより、探索自身が出している不確実性の方が有用なbudget-allocation signalになっている、という結果になる。

## 128時点のQ最大をそのまま選ぶだけでは駄目だった

ここで一つ安い代替案も考えられる。

UNSTなら、追加探索せずに128 simulations時点でもっともQが高いchildを選べばよいのではないか、というものだ。

しかしこれはうまくいかなかった。

UNST rootで、128 simulations時点のhighest-Q childが2,048 simulations後の着手と一致した割合は19%しかなかった。

つまり、Q disagreementは「まだ読み足りない」というsignalにはなるが、その時点のQ値自体をそのままtrustして着手を差し替えるほど安定してはいない。

追加探索が必要だった。

## prior 2%未満の手を救ったときの改善が最も大きかった

もう一つ興味深かったのは、深い探索が選び直した手のpolicy priorだった。

2,048 simulationsで選ばれたactionが、元のnetworkではprior 2%未満しか与えられていなかったケースでは、平均改善が+12.3ptまで大きくなった。

network policyがほとんど候補として評価していない手でも、探索を十分に続けると最終的に最善候補へ浮上する場合がある。

以前raw policy targetへ変更したとき、priorを尖らせすぎない方がPUCT-128では強かった。今回の結果も、有限budgetの探索では低priorの良い手を十分に掘れないケースがまだ残っていることと整合する。

ただし今回のpilotだけで、それが同じmechanismだとまでは言えない。

## 次は「怪しい局面だけ2,048まで読む」

今回の結果を受けて、全局面を一律に2,048 simulationsへ増やすのではなく、探索の内部状態を使って追加budgetを配る案を試す。

候補は次のようなものになる。

1. まず現在と同じ128 simulationsを行う
2. ply 40以降で、8 visits以上あるchildのQが現在のvisit leaderより0.02以上高ければtrigger
3. triggerされたrootだけ、同じ探索木を2,048 simulationsまで継続
4. 最後にmost-visited childを選ぶ

次のclaim-bearingな比較では、単純に「128 vs gated 2,048」を比べるのではなく、1ゲームあたりのrealized simulationsを合わせたuniform searchと比較する予定になっている。

これで強くなれば、「探索budgetを増やしたから」ではなく、「同じ計算量を、探索自身が不安定だと示したrootへ重点的に配ったから」という違いを見られる。

さらにその先では、play-timeだけでなくself-play collection側にも同じgatingを入れ、同じcomputeで128-simの対局数を増やす方が良いのか、少数のcritical stateを深く読む方が学習にも有効なのかを比較する。

今回のpilotで分かったのは、現在のFでも終盤の探索余地はまだ消えていないことと、深く読む場所をgame-state heuristicだけで決めるより、visitとQの食い違いを見る方がかなり有望だということだった。

---

この記事は、実装・実験記録をもとに、本文の編集を主にLLMが行い、筆者が内容を確認・修正しています。
