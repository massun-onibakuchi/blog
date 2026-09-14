---
title: "Splendor AIにEntity-Action Transformerを導入した"
date: "2026-09-13"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "neural-network"]
---

Splendor をプレイする policy-value model を作っている。

これまでは、盤面を固定された tensor layout に変換し、その state representation から policy と value を出す比較的小さい model を使っていた。

今回はそこから構造を大きく変えて、EAT と呼んでいる新しい model を導入した。

EAT は Entity-Action Transformer の略で、カードや貴族などの盤面要素を semantic entity として扱い、legal action も candidate entity として直接評価する model である。

今回やったことは、この新しい architecture を実装し、学習、ONNX export、native evaluator、PUCT まで一通り接続して、実際に動かせる model path にしたところまでになる。

強さを確かめるための実験ではない。

## なぜ表現を変えたか

従来の model では、ゲーム状態をあらかじめ決めた feature layout に押し込み、その固定表現を neural network に渡していた。

これは軽量で扱いやすい。一方で、Splendor の状態には性質の異なる object が多い。

- 場に出ているカード
- 山札に残っているカード
- プレイヤーが予約したカード
- 貴族
- プレイヤー自身の状態

行動側にも、カード購入、予約、token 操作など、異なる対象と意味がある。

EAT ではこれらを「固定位置の数値」よりも「意味を持つ entity と action」として model に渡す方向へ寄せた。

## semantic entityとして盤面を表す

EAT では、残っているカード、場のカード、予約カード、貴族などを entity として並べる。

例えばカードなら、単に card ID の位置だけを使うのではなく、tier、bonus、prestige、cost など、そのカード自身の意味を表す feature を持たせる。

各 entity を共通の hidden representation に変換し、その集合に attention をかける。

そのため、盤面上の object の関係を固定した flat vector の位置だけに依存せず扱える。

## actionもcandidateとして扱う

policy 側も変えた。

legal action ごとに candidate representation を作り、その action が対象にしているカードや貴族などの情報を含める。

概念的には次のような構造になる。

```text
semantic entities
  -> state attention

legal action candidates
  -> stateへのcross-attention
  -> policy score

state/context
  -> value-specific path
  -> loss / draw / win
```

policy は、固定された action index だけから score を出すのではなく、現在の state と各 candidate action の関係から score を作る。

この candidate-to-state の経路は、今後 action representation を改善するときにも重要になる部分だと考えている。

## policyとvalueを同じtrunkに押し込まない

value 側には専用の path を持たせた。

policy が必要とする情報と、局面全体の勝敗を予測する value が必要とする情報は完全には同じではない。

そのため、shared representation は持ちつつ、value 用の context を別に処理できる構造にしている。

今回導入した model は約1,102万 parameter になった。

以前の model よりかなり大きいが、今回の目的は parameter 数を増やすことそのものではなく、今後の model 改善を行える semantic な構造を作ることにある。

## 学習まで通した

architecture だけ実装して終わりにはせず、既存の teacher data を使って有限の supervised bootstrap も行った。

1,024 groups、119,768 rows を使い、train / validation / test を group 単位で分割した。

| split | groups | rows |
| --- | ---: | ---: |
| train | 768 | 89,868 |
| validation | 128 | 14,982 |
| test | 128 | 14,918 |
| total | 1,024 | 119,768 |

policy target は既存 teacher の分布、value target は最終的な loss / draw / win を使った。

optimizer は AdamW、effective batch size は256、1,500 updates の固定 run にした。

この run の目的は、EAT が実際の training pipeline で optimization でき、checkpoint を後続の inference path に渡せることを確認することだった。

training loss は update 1 から update 1500 にかけて下がり、固定 test set の policy CE や WDL loss も初期値より改善した。

これは model の強さを示す結果ではない。少なくとも、新しく作った architecture が teacher signal を受け取って学習できることを確認するための結果として使っている。

## ONNXとnative evaluatorまでつないだ

学習した PyTorch checkpoint は ONNX に export し、native 側の evaluator から呼べるようにした。

さらに、その evaluator を既存の PUCT に接続した。

ここまで通したことで、

```text
semantic feature generation
-> PyTorch training
-> checkpoint
-> ONNX export
-> native inference
-> PUCT
-> game execution
```

という一連の経路が成立した。

これは今後 EAT を実際の self-play や search 改善に使うための土台になる。

## 今回の到達点

今回の進捗は、新しい EAT architecture の強さを評価したことではない。

Entity-Action Transformer という新しい model family をコードベースへ導入し、semantic entity encoding、candidate-conditioned policy、value path、training、export、native inference、PUCT までを1本の実行可能な経路として成立させたことが到達点になる。

今後はこの model を基準に、学習データ、objective、architecture、search との接続をそれぞれ改善していく。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
