---
title: "25本の自己対局実験を横断整理し、今後の開発ロードマップを再設計した"
date: "2026-09-29T09:58:19Z"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

個別の探索ルール（search rule）、行動表現（action representation）、学習量、データ生成手法を検証する実験が25本まで増えた。そこで各レポートに書かれた「次にやること」をそのまま追うのではなく、得られた実験結果をフラットに並べ直して研究の優先順位を再設計した。

## 25本の実験横断で残った事実

| 観測項目 | 実際の測定結果 | 次の判断 |
| --- | --- | --- |
| self-play loop | G0→G3で+10.87 pt [+9.16, +12.57] | ループ自体は機能して学習が進んでいる |
| PUCT設定のtransfer | G4 treatmentがcontrolに+3.26 pt [+2.06, +4.45] | self-playのハイパーパラメータ設定は勝率に大きく影響する |
| rule opponent | G4がpoint rush / reserve anchorに約88〜90% | 1〜2 pt規模の改善を測るには相手として飽和気味 |
| decisive search | v3 − v2 = +0.82 pt [+0.37, +1.28] | 明確な探索上の欠陥（defect）は修正する価値がある |
| 追加exactness | v4 − v3 = +0.09 pt [-0.15, +0.32] | 探索ルールの過度な細分化は優先度を下げる |
| post-refill recourse | 0.00329 score/event、自然occupancyでは約0.07 pt/game | no-blind環境での実力向上を狙う主たるアプローチには置かない |
| target diagnostic | corrected visits regret 0.0359、raw 0.0167、Gumbel 0.0059 | 教師ターゲットの構成手法を直接A/Bテストで比較する |
| G4 campaign cost | collection 2.34 h、fit 0.26 hに対しarena 4.87 h | 評価コスト自体も研究の計算資源バジェットとして管理する |

この一覧を整理すると、モデルのキャパシティや細かな探索ヒューリスティクスをいじる前に、学習パイプライン（recipe）と評価基盤（instrument）を固める必要性が見えてきた。

## 研究順序を変えた

今後の順番は次の通りにした。

| 順位 | 実験 | 目的 |
| ---: | --- | --- |
| 1 | frozen strength ladder | 世代間の強さを同じ物差しで測る |
| 2 | multi-generation continuation | 同じrecipeでlearning curveを得る |
| 3 | policy / value target screen | learnerへ何を教えるかを比較する |
| 4 | update budget、data quantity | 1世代の学習量を決める |
| 5 | collection breadth vs search depth | 同じcomputeの使い道を比較する |
| 6 | start-state diversity | rare stateや終盤threatを補う |
| 7 | blind reserve対応 | 最終的なBGA contractへ近づける |

一方、128 simulations付近での細かなPUCTグリッドサーチや、追加の終盤ヒューリスティクス、CPUレベルのマイクロ最適化は優先度を下げた。staged actionの実装はblind reserve対応の基盤として残すが、現在のno-blind環境で実力を伸ばすための主要なアプローチには据えない。

## 個別パッチから学習システム全体へ

これまでの実験を通じて、探索処理の改善が実力差に直結するケースと、手を入れても勝率がほとんど変わらないケースを明確に区別できるようになった。現状で足りていないのは、「同一条件下で持続的に強くなるか」「どの教師ターゲットが優れているか」「1世代あたりにどれだけ学習ステップを割り当てるべきか」という、学習システムの根幹をなす要素の検証である。

以後の実験では、局所的な指標にとどまらず、固定ベンチマーク（frozen ladder）上での最終的な対局性能への反映度合いを基準に採否を判断していく。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
