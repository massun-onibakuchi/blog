---
title: "Splendor AIでsearch self-playを3世代回したら固定panelで+10.9pt改善した"
date: "2026-09-21"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "self-play"]
---

Splendor をプレイする policy-value model として EAT（Entity-Action Transformer）を作っている。

教師あり学習した EAT に PUCT を重ねると、同じ network の raw policy よりかなり強くなることは確認できていた。

次に知りたかったのは、その探索結果を教師として network に戻し、それを何世代か繰り返したときに、本当に対局性能まで伸びるかだった。

そこで3つの独立した training track で search self-play を3世代回した。

結果は、generation 0 の固定 panel score 70.09% に対して、generation 3 は 80.96% だった。

差は +10.87 percentage points、pair-clustered 95% interval は [+9.16, +12.57] points だった。

今回の条件では、search self-play を繰り返した後の model が明確に強くなった。

## search self-playで何をしているか

1世代の流れは単純である。

現在の EAT で PUCT 128 simulations の self-play を行い、探索後の policy distribution と最終的な勝敗を training target にする。

そのデータで EAT を追加学習し、できた model でもう一度 self-play する。

各世代では32,768 rowsを残し、512 optimizer updatesを行った。

policy head は search target、value head は terminal WDL を学習する。

これを seed 1701、2901、4301 の3本で独立に進め、各 track を generation 3 まで到達させた。

1 track あたりの累積 update 数は1,536である。

全9 fitsでは294,912 retained rows、4,608 updates、約472万 row presentationsを使った。

## 評価は最初のmodelと最後のmodelを同じ条件で比べる

学習 loss が下がるだけでは、Splendor が強くなったとは言えない。

そのため最終評価では、generation 0 と generation 3 を同じ opponent panel、同じ search 条件で比較した。

opponent は3種類である。

- 以前の EAT checkpoint
- depth-3 の非学習 teacher
- prestige を優先する point-rush rule policy

learned model 側は clean PUCT 128 simulations、root noiseなし、temperature 0、tree reuseなしで固定した。

3 training tracks × 3 opponents の9 cellsについて、同じ start schedule を generation 0 と generation 3 で対応させて比較した。

generation 3 側だけで4,992 games、対応する generation 0 control も4,992 gamesある。

途中で良かった seed や checkpoint を選ぶことはしていない。

## 3本ともほぼ同じだけ改善した

結果は次の通りだった。

| training track | generation 3 - generation 0 |
| --- | ---: |
| 1701 | +11.11 points |
| 2901 | +11.10 points |
| 4301 | +10.38 points |

3本すべてで改善し、track 間の差も小さかった。

全 cell を等しく重み付けした panel score は、

| | score |
| --- | ---: |
| generation 0 | 70.09% |
| generation 3 | 80.96% |
| difference | +10.87 points |

となった。

95% interval は [+9.16, +12.57] points で、事前に置いていた「point estimate が +2 points 以上、interval lower bound が0より大きい」という判定条件を通過した。

## 相手ごとに見ると改善幅は違った

3 track 平均で opponent ごとに見ると、

| opponent | G0 | G3 | difference |
| --- | ---: | ---: | ---: |
| historical EAT | 50.55% | 70.61% | +20.05 points |
| depth-3 teacher | 80.56% | 88.15% | +7.60 points |
| point-rush | 79.17% | 84.11% | +4.95 points |

だった。

一番大きく伸びたのは以前の EAT に対してで、もともと強く勝てていた rule policies に対しても追加の改善が出ている。

特定の1種類の相手だけに合わせて伸びた、という結果にはなっていない。

## 途中で数値一致のgateに止められた

この実験は一度、generation 2 の checkpoint qualification で止まった。

PyTorch と ONNX/native evaluator の raw logits に数マイクロ程度の差があり、当時固定していた parity gate を満たさなかったためである。

ここで結果を見た後に tolerance を広げてそのまま続けることはしなかった。

代わりに、実際の inference consumer が使う policy probability、WDL probability、acting-seat value、argmax と、保守的な absolute raw-logit guardを中心に numerical acceptance contract を作り直した。

この新しい contract は、残りの学習や generation 3 の arena outcome を見る前に固定した。

その条件で9 artifacts × CPU / CUDAを含む27 qualification runsがすべて通り、generation 3 の学習と評価を再開した。

raw logit の完全一致を要求しすぎると、実際の action probability や value が十分一致していても実験そのものを止めてしまう。一方で、失敗した artifact を見てから gate を緩めると selection bias が入る。

今回はこの2つを分けて扱えたのも大きかった。

## 今回分かったこと

一番重要なのは、少なくともこの3 training tracks、この固定 opponent panel、この PUCT 128 の評価条件では、search self-play を3世代繰り返すことで playing strength が改善したことである。

教師あり bootstrap のあとに探索を重ねるだけでなく、その search policy をもう一度 network に吸収させるループにも価値があることが確認できた。

ただし、+10.87 points を一般的な強さの上昇量として扱うことはできない。

training seed は3本だけで、opponent も固定した3種類である。Elo を測ったわけでもなく、どの要素が何 points 寄与したかを分解した実験でもない。

また、今回比較しているのは generation 0 と generation 3 に同じ PUCT を組み合わせた playing stack なので、raw policy 単体が同じだけ改善したという意味でもない。

それでも、これまで未確認だった「search target を繰り返し学習しても本当に強くなるのか」という問いには、初めて肯定的な結果が出た。

次は、この loop を前提にして search operator、action representation、model architecture の変更を評価できる。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
