---
title: "機械学習の実験レポートを「履歴」と「索引」に分けた"
date: "2026-09-21"
isPublished: true
lang: ja
tags: ["machine-learning", "research", "engineering"]
---

Splendor の機械学習プロジェクトでは、モデル構造、特徴量、探索、学習データなどを頻繁に実験している。

実験が増えてくると、結果そのものとは別に「過去に何を試したかをどう管理するか」が問題になってきた。

今回、実験レポートの管理方法を整理した。

ポイントは、レポート本文を履歴として保存し、検索や現在の意味づけだけを frontmatter に持たせることにした点である。

## 実験レポートは後から現在の結論に合わせない

実験レポートには、その時点で観測した条件、結果、そこから言えることを書く。

数週間後に新しい実験が出て、昔は有力だった仮説が弱くなることもある。

そのたびに古いレポート本文を書き換えると、当時何が観測され、何を根拠に判断したのかが消えてしまう。

そこで completed report の本文は historical evidence として扱う。

後から考えが変わっても、過去の観測を現在の結論に合わせて書き直さない。複数の実験を踏まえた現在の考えは、別の synthesis として表現する。

## ただし古いレポートが今も重要とは限らない

本文を保存するだけでは、別の問題が出る。

レポートが増えると、検索結果に古い実験が大量に出てきても、どれを今の判断に使ってよいか分からない。

そこで各 report の frontmatter に、本文とは別に小さい metadata を持たせる。

現在は kind、status、question、hypothesis、outcome、conclusion、relevance、scope、tags を持つ。

特に重要なのが relevance と scope である。

本文は「その実験で何が観測されたか」を保存する。

relevance と scope は「その evidence を今どこまで使ってよいか」を表す。

historical evidence と current applicability を分離することで、過去を消さずに現在の検索結果を整理できる。

## indexファイルは作らない

全レポートをまとめた INDEX.md のようなファイルを作る方法も考えられる。

しかし report を追加するたびに report 本体と index の両方を更新する必要がある。status や conclusion が変われば index 側も追従しなければならない。

これでは同じ情報の owner が2つになる。

LLM を使った開発では、この種の二重管理は特に避けたい。片方だけ更新されても文章として自然に見えるため、drift が見つけにくい。

そこで report ごとの frontmatter を唯一の catalog source にした。

catalog 自体は保存しない。必要なときに全 report の metadata を読んで、その場で生成する。

report A / B / C の frontmatter から catalog view を導出するだけである。

index は artifact ではなく view として扱う。

## catalogは「読む前の索引」にする

catalog はレポート本文の代わりではない。

細かい条件や exact な記述を調べるなら、普通に全文検索や grep を使えばよい。

catalog が便利なのは、研究 corpus 全体を浅く見るときである。

例えば、過去にどんな実験をしたか、この仮説はすでに試したか、似た問いを扱う report はどれか、active な evidence はどれか、といったことを各ファイルを開かずに確認できる。

question、outcome、conclusion、relevance、scope を一覧して、そこから必要な report に逆引きする。

つまり catalog は mandatory な retrieval path ではなく、shallow corpus scan と index view である。

## metadata contractも二重管理しない

次に問題になるのが frontmatter の schema である。

AGENTS.md に field の意味や enum を全部書き、lint の Python code にも同じ constraint を持たせると、また二重管理になる。

そこで schema の owner も parser / validator に一本化した。

field名、enum、文字数制約、cross-field rule、semantic rule は同じ定義から validation と human-readable contract の両方に使う。

report を編集する agent は report_catalog.py contract を実行して、その時点の canonical contract を読む。

AGENTS.md は schema のコピーではなく、どの command を使うかだけを示す小さい router にした。

## lintは変更したreportだけを見る

repository に historical report が増えてくると、全 report を常に current schema で strict validation するのも扱いづらい。

新しい contract を導入しただけで、今回触っていない昔の report が失敗して現在の作業を止める可能性がある。

そこで lint は main との merge base から見て変更された active report だけを検証する。

変更した report は current contract を満たす。一方、変更していない historical artifact を別件の作業で突然 migration 対象にはしない。

これは validation を弱くするというより、変更責任の境界を明確にするための設計である。

## reportの真実を3種類に分ける

現在は report 周りの情報をだいたい3種類に分けて考えている。

1. report body: その実験で実際に観測した evidence
2. report metadata: その evidence の問い、結論、現在の relevance / scope
3. synthesis: 複数の evidence を踏まえた現在の考え

この3つを混ぜない。

特に「現在はこう考えている」を昔の report 本文へ逆流させないことが重要だと思っている。

研究では結論が変わるのが普通なので、過去の evidence と現在の belief を同じ document に押し込むと、時間が経つほど provenance が分からなくなる。

## LLMに全部読ませない

この仕組みは LLM を coding / research agent として使うときにも効いている。

report が増えるほど、毎回全部読むのは context の無駄になる。一方、file name だけでは、その report が何を答えたのか分からない。

frontmatter を短い semantic index にしておけば、最初に catalog だけ見て関係する report を選び、そのあと必要な本文だけを読める。

これは token 節約だけではなく、irrelevant な historical context を大量に入れて判断を濁らせないためでもある。

## 現在の形

最終的にはかなり単純な構成になった。

docs/reports の各 Markdown が source of truth で、frontmatter から catalog を都度導出する。

report_metadata.py が parser、validator、changed-report selection、contract rendering を持つ。

report_catalog.py は table / JSON / contract の view を出し、report_frontmatter_lint.py は変更された report metadata だけを検証する。

永続的な index database や ledger はない。

report そのものが source of truth で、catalog はそこから導出される。

ドキュメント側にも schema の複製は置かない。

機械学習の実験では、モデルやデータだけでなく、過去の証拠を後からどう検索し、どう再解釈するかも研究速度に効く。

実験レポートを単なる Markdown の山にせず、かといって重い実験管理システムにもせず、historical evidence と lightweight metadata の間くらいに置くのが今のところ扱いやすい。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
