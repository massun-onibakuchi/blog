---
title: "実験レポートが増えすぎたので、検索用catalogを作った"
date: "2026-09-21"
isPublished: true
lang: ja
tags: ["machine-learning", "research", "engineering"]
---

Splendor の機械学習プロジェクトでは、モデル構造、特徴量、探索、self-play などをかなり頻繁に試している。

実験そのものは増やせるようになったが、別のところで詰まり始めた。

過去の report が増えすぎて、「この仮説はもう試したか」「似た失敗はなかったか」「今も読む価値がある report はどれか」を探すのに時間がかかる。

そこで、実験レポート用の小さい catalog tool を入れた。

大げさな experiment tracking system ではない。

Markdown report の frontmatter を読んで、question、outcome、conclusion、relevance、scope だけを一覧できるようにしたものだ。

これが思ったより使いやすかった。

## reportが増えると「検索」が研究コストになる

実験が10本くらいなら、ファイル名を見て順番に開けばよい。

しかし数が増えると、それだけでは厳しい。

例えば新しい仮説を考えたときに知りたいのは、

- 似た問いを以前に検証していないか
- そのときの結論は何だったか
- その evidence は今も active なのか
- 条件が違うだけで、まだ使える結果なのか
- superseded されて読む必要が薄いのか

といったことになる。

ファイル名だけでは分からない。

全文 grep もできるが、exact wording を知らないと取りこぼすし、検索結果から何本も本文を開く必要がある。

LLM に全部読ませる方法もあるが、report が増えるほど context を無駄に使う。

つまり実験の実行速度が上がるほど、過去の evidence を探す時間が新しい bottleneck になってきた。

## 欲しかったのは重い管理画面ではなく「目次」だった

必要だったのは、W&B や MLflow のように run metric を可視化する仕組みではなかった。

training run や artifact の管理ではなく、研究上の問いと結論を探したかった。

例えば最初に、

| report | question | outcome | conclusion | relevance |
| --- | --- | --- | --- | --- |
| ... | ... | ... | ... | ... |

のような一覧を見て、読むべき report を数本に絞れれば十分だった。

そこで各 report の frontmatter に、検索用の metadata を持たせることにした。

現在は kind、status、question、hypothesis、outcome、conclusion、relevance、scope、tags を持っている。

本文を要約するための metadata というより、研究 corpus を navigate するための metadata である。

## catalog toolを入れた

catalog は repository 内の report frontmatter を読み、その場で一覧を生成する。

普段は Markdown table として見る。

machine-readable に扱いたいときは JSON でも出せる。

使い方は単純で、catalog command を実行するだけである。

これで例えば「value learning に関する過去の experiment をざっと見たい」ときに、各 report を開く前に question と conclusion を並べて見られる。

そこから必要な report だけ本文を読む。

LLM に調査させる場合も同じで、最初に catalog を見せて候補を絞らせ、そのあと必要な report だけ読ませる。

全 corpus を毎回 context に入れる必要がなくなった。

## INDEX.mdは作らなかった

最初に考えやすいのは、全 report をまとめた INDEX.md を手で更新する方法である。

これは採用しなかった。

report を追加するたびに、

1. report 本体を書く
2. INDEX.md に追記する

という2回の更新が必要になる。

さらに conclusion や relevance が変われば、両方を同期させなければならない。

LLM を使った開発では、この種の二重管理はかなり危ない。

片方だけ古くても文章として自然なので、drift が発見しづらい。

そこで frontmatter を唯一の source of truth にして、catalog は保存しないことにした。

index は file ではなく view として毎回生成する。

この形なら report を直せば catalog も自動的に変わる。

## relevanceとscopeが判断を支えた

単に question と conclusion だけを一覧するだけでも便利だが、実際の判断材料になったのは relevance と scope だった。

実験結果は、その後の研究で意味が変わる。

例えば当時は重要だった結果でも、モデル構造が大きく変われば直接は使えないことがある。

逆に、古い report でも特定条件ではまだ有効なこともある。

そこで report body は当時の evidence として残し、現在の applicability だけ metadata 側で表現する。

古い report 本文を現在の belief に合わせて書き換える必要がない。

過去の証拠は残しつつ、今読むべきものは catalog 上で分かる。

## schemaまで手書きするとまた二重管理になる

frontmatter を入れると、次は schema の管理が必要になる。

field名や enum を AGENTS.md に書き、その一方で lint code に同じルールを書くと、また2つの source of truth ができる。

そこで contract も tool 側から生成することにした。

parser / validator が持っている field definition から、人間や coding agent が読む contract をその場で出す。

report を作るときは、その command を先に読む。

AGENTS.md には schema 自体をコピーせず、「この command で contract を確認する」とだけ書く。

これで schema を変更しても、documentation と validator が別々に drift しない。

## lintで古いreport全部を直させない

もう1つ避けたかったのが、catalog schema を更新しただけで昔の report 全部を直すことだった。

historical report は研究 evidence であって、repository の最新形式へ常に migration すること自体が目的ではない。

そのため lint は main との merge base から見て変更された active report だけを検証する。

今触った report は current contract を満たす。

触っていない昔の report は、別件の変更を block しない。

これで metadata の品質は保ちつつ、管理のための migration work を増やさずに済む。

## 導入して何が変わったか

一番大きいのは、過去の experiment を探すときに「まず何を読むか」を決めやすくなったことである。

以前は file tree と grep を見ながら複数 report を開いていた。

今はまず catalog を見て、question / conclusion / relevance / scope から候補を絞る。

新しい仮説を考えるときにも、過去に何を試したかを shallow scan してから設計に入れる。

LLM agent にとっても、全 report を無差別に読むより、最初に metadata で routing できる方が扱いやすい。

実験管理のために重いサービスを導入したわけではない。

Markdown report はそのままで、frontmatter と数百行程度の小さい CLI を足しただけである。

それでも、

- evidence を探す
- 重複実験を避ける
- 古い結果の現在性を判断する
- LLM に必要な report だけ読ませる
- index や schema の二重管理を避ける

という pain をかなりまとめて解消できた。

研究コードでは実験そのものに目が行きやすいが、実験数が増えた後は「過去の知識へどうアクセスするか」も throughput の一部になる。

今のところ、このくらい軽い catalog tool がちょうどよい。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
