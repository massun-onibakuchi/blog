---
title: "Splendor AIの自己対局で、探索のためのランダム性と学習する教師信号を分離した"
date: "2026-08-17"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "reinforcement-learning", "search"]
---

Splendor をプレイする policy-value model を、PUCT というゲーム木探索と自己対局で改善している。

ここまでで、教師あり学習から最初の自己対局 generation を作り、challenger を学習して promotion するところまでは一度通った。一方で、その後の generation では新しいモデルがほとんど incumbent と同じ強さに留まった。

探索自体には改善能力があることも別の実験で確認できた。同じモデルでも、raw policy のまま指すより PUCT をかけた方が明確に強い。

すると次に気になるのは、探索が作った改善を「どんな教師信号としてニューラルネットワークへ返しているか」になる。

今回は自己対局の training target を見直し、探索中に必要なランダム性と、モデルに学習させたい分布を分離した。あわせて、policy だけでなく value 側にも探索結果を使えるよう、各局面の post-search value を保存するようにした。

まだこの変更後のモデルが強くなったという実験結果はない。今回の進捗は、次の学習実験で比較できる教師信号を正しく作れるようになったことにある。

## 自己対局では「遊び方」と「学習対象」が同じとは限らない

自己対局では、毎手 PUCT を実行する。

ニューラルネットワークが出した policy を事前分布として探索し、各合法手に何回 simulation が入ったかを数える。ある局面で合法手が $a_1, a_2, \dots, a_K$、それぞれの visit count が $N(a)$ なら、典型的な policy target は

$$
\pi(a) = \frac{N(a)}{\sum_b N(b)}
$$

のような分布になる。

モデルは次回、探索前の policy だけでこの $\pi$ に近づくよう学習する。

ただし自己対局では、毎回最も強そうな手だけを選ぶと似たゲームばかりになる。そのため探索にはランダム性を入れる。

このランダム性には少なくとも2種類ある。

ひとつは root の policy に混ぜる Dirichlet noise。探索開始時に、元の prior $p(a)$ を

$$
p'(a) = (1-\varepsilon)p(a) + \varepsilon\eta(a)
$$

のように揺らす。$\eta$ は Dirichlet 分布からサンプルしたノイズで、普段は優先されない手にも simulation を割り当てるために使う。

もうひとつは、探索後の visit distribution から実際にどの手を指すかを決める temperature である。temperature を高くすると visit が2位や3位の手も選ばれやすくなり、0にすると最大 visit の手を決定的に選ぶ。

どちらも自己対局の探索範囲を広げるには役に立つ。

しかし、「探索中にわざとランダムにした部分まで、そのまま正解として模倣したいか」は別問題になる。

## 以前は move temperature が policy target まで変えていた

これまでの実装では、探索後の visit count に temperature を適用した分布を、そのまま手の選択にも学習 target にも使っていた。

たとえば temperature が0なら、最大 visit の手だけが1になる one-hot distribution を作る。

```text
raw visits
[18, 8, 4, 2]

temperature = 0
[1, 0, 0, 0]
```

実際の対局で決定的に手を選ぶという意味では正しい。

ただし学習 target として見ると、探索が「1位18 visits、2位8 visits」と評価した情報を捨ててしまう。

探索結果には、1位だけでなく候補間の相対的な評価が入っている。policy を蒸留するなら、その soft distribution を残した方が自然である。

そこで今回、2つを別のものとして扱うようにした。

```text
探索が作る training target
    = corrected visit counts を正規化した soft distribution

自己対局で実際に指す手
    = corrected visit counts に move temperature を適用して選択
```

つまり temperature は「環境でどの手を選ぶか」だけを制御し、保存する policy target は変えない。

temperature が0でも、たとえば corrected counts が `[18, 8, 4, 2]` なら target は

$$
\left[\frac{18}{32}, \frac{8}{32}, \frac{4}{32}, \frac{2}{32}\right]
$$

のまま残る。

これで deterministic にゲームを進めながら、探索が持っていた soft な順位情報を学習できる。

さらに opening だけ別 temperature にする設定も入った。

序盤の数 decision は高めの temperature で多様な手を選び、その後は低い temperature に落とす、といった schedule が使える。ゲームの最後まで同じ強さのランダム性をかけ続ける必要がなくなった。

## Dirichlet noise で増えた visits を別に数える

もうひとつの変更は、root noise の扱いである。

Dirichlet noise は探索を広げるために意図的に prior を歪める。問題は、そのノイズによって増えた visit まで教師信号にすると、「探索が本当に評価した手」と「探索を広げるために試した手」が混ざることである。

新しい探索では、各 simulation について

```text
noise を混ぜた prior で選ぶ root action
```

と

```text
noise を混ぜない prior で選ぶ root action
```

を比較する。

両者が違った場合、その simulation は noise によって root の選択が変わった visit として別に数える。

各手について raw visit を $N(a)$、noise-attributed visit を $D(a)$ とすると、通常は

$$
\tilde N(a) = N(a) - D(a)
$$

を training target に使う。

つまり policy target は

$$
\pi(a) = \frac{\tilde N(a)}{\sum_b \tilde N(b)}
$$

になる。

ここで重要なのは、「Dirichlet noise の数学的影響を完全に逆算して除去している」という意味ではないことだ。

実装が追跡しているのは、同じ探索統計の時点で noisy prior と clean prior が別の root action を選んだ simulation である。その分を noise-attributed visits として明示的に分離している。

また、補正後の visits が少なすぎる場合は無理に使わない。clean visits が raw total のおよそ1/8未満まで減る場合には raw counts に戻す。

探索を広げるための noise を除こうとして、教師信号そのものが数サンプルだけの不安定な分布になるのを避けるためである。

## 「探索するためのノイズ」と「学習する分布」を分ける

この変更の考え方は単純である。

自己対局には exploration が必要だが、exploration のために加えたランダム性を全部そのまま imitation target にする必要はない。

```text
model policy
    ↓
Dirichlet noise を加えて探索を広げる
    ↓
PUCT simulations
    ↓
noise-attributed visits を分離
    ↓
corrected soft policy target を保存
    ↓
move temperature で実際の行動だけを選ぶ
```

以前は、この途中にある複数の目的がひとつの visit distribution に押し込まれていた。

今回、探索、行動選択、学習 target を別の役割として持てるようになった。

これは「どの temperature が最強か」というハイパーパラメータ調整より前の話で、何を教師信号としているのかという semantics の修正になる。

## value 側にも post-search value を残すようにした

policy target と同時に、各自己対局局面には探索後の root value も保存するようになった。

PUCT の場合、noise correction 後の visit count を重みとして、各 root action の探索済み平均 value を平均する。

各手の平均探索 value を $Q(a)$ とすると、概念的には

$$
r = \frac{\sum_a \tilde N(a) Q(a)}{\sum_a \tilde N(a)}
$$

である。

$r$ は acting player から見た $[-1,1]$ の値として保持する。

これまで value head の教師信号は、ゲーム終了時の win / draw / loss だけだった。

終局結果は最終的な真実という利点がある一方、1ゲームの全局面に同じ結果が付くため、途中局面ごとの細かい差を直接は持っていない。

今回の変更では、終局結果を捨てるのではなく、必要なら search value を少量だけ混ぜられるようにした。

terminal WDL の one-hot target を $y$、search value を $r$ とすると、まず $r$ を

$$
\operatorname{searchWDL}(r)
=
\left[
\frac{1-r}{2},
0,
\frac{1+r}{2}
\right]
$$

へ写す。

そして重み $\lambda$ を使って

$$
y^* = (1-\lambda)y + \lambda\operatorname{searchWDL}(r)
$$

を value loss の target にできる。

現在の仕組みでは $\lambda$ は最大0.5までに制限されている。

この search value は draw probability を持っていないため、中央の draw mass は0になる。また探索 value 自体も完全な真値ではない。したがってこれは terminal outcome の置き換えではなく、bounded な補助的 target として比較実験できるようにしたものになる。

設定しなければ、従来どおり terminal WDL だけで学習する。

## 自己対局データが「後から検証できる」形になった

今回、各 decision には policy target だけでなく、次の探索統計も保持するようになった。

- raw visit counts
- noise-attributed visit counts
- raw / noise visit total
- post-search root value
- 実際に完了した simulation 数

これらは単なるログではない。

たとえば policy target が想定以上に尖っていたとき、それが探索そのものの結果なのか、noise correction で visits が減ったためなのかを後から調べられる。

value mix を試したときも、元になった root value を保存しているので、terminal outcome だけの実験と比較できる。

自己対局データを大量に作ってから「教師信号の作り方を確認できない」という状態を避けるための観測点でもある。

## これで強くなったとはまだ言えない

今回の実装は main に入り、Python のテストスイートと native C++ のテスト 13/13 が通っている。

ただし、ここは区別しておきたい。

確認できたのは、

```text
探索用 noise
行動選択 temperature
policy training target
optional search value target
```

をそれぞれ別の役割として扱えるようになったことまでである。

この変更によって challenger の playing strength が上がったかは、まだ測っていない。

特に search-value mixing は使えるようになっただけで、terminal-only より良いと決まったわけではない。noise-corrected target や opening temperature schedule についても、最終的には arena でモデル同士を比較する必要がある。

一方で、次の実験で何が変わったかを以前より明確に切り分けられるようになった。

以前の停滞では、「探索に改善信号がないのか」「学習量が足りないのか」「自己対局 target の作り方が悪いのか」が混ざっていた。

探索の強さと学習量についてはすでに個別に測り始めている。今回、training target の semantics も実験可能な形に揃った。

次は、探索が持っている改善をニューラルネットワークへどの経路で返すと最も強さにつながるのかを、一つずつ比較できる。

---

※ 本記事は、実装・仕様・テスト結果をもとに、AI と共同編集した。
