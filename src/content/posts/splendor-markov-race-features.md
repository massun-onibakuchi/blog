---
title: "Splendor AIのvalueが手番を見ていなかったので特徴量を追加した"
date: "2026-09-01"
isPublished: true
lang: ja
tags: ["splendor", "machine-learning", "value"]
---

教師game数を増やしてもplaying strengthが伸びなかったため、valueへ渡しているstate representationを見直した。すると、equal-turn終了に必要なstarting-player情報がmodel inputから消えていた。

## representation aliasingが起き得た

player rowsは「actor / opponent」順へ並べ直していたため、actorがstarting playerかどうかをvalue headから直接識別できなかった。

同じprestigeやcardsでもstarting playerが違えば、15点到達後に相手へもう一度turnが回るかが変わる。異なるtrue valueを持つstatesが同じfeatureへ写る representation aliasing になり得る。

## 追加したfeature

最初の実験案ではglobal featureを4→10へ増やした。

| feature | normalization |
| --- | --- |
| actor is starting player | 0 / 1 |
| game ply | `game_ply / 160` |
| prestige difference | `(self - opp) / 22` |
| purchased-card difference | `(opp - self) / 30` |
| self distance to 15 | `(15 - self prestige) / 15` |
| opponent distance to 15 | `(15 - opp prestige) / 15` |

starting-playerとgame-plyは従来inputから欠けていた情報で、残りは既存player rowsから導出できるrace summaryである。

architectureはglobal encoder inputを94→100へ広げるだけにし、attention trunk、policy head、WDL headは変えなかった。

## paired designでfeature差だけを見る

| item | value |
| --- | ---: |
| paired replicates | 8 |
| groups / arm | 29,400 |
| games / arm | 58,800 |
| training rows / arm | 419,840 |
| max optimizer steps | 16,000 |
| checkpoint interval | 1,000 steps |

control / treatmentでgames、retained rows、policy targets、terminal WDL targets、row orderを同一にした。testやarenaを見る前にvalidation joint lossだけでcheckpointを固定する。

評価順序は、WDL Brier改善 → policy KL non-inferiority → horizon guardrail → fresh PUCT32 arenaとした。

この時点では実装とpreregistrationまでで、scientific outcomeはまだなかった。後続実験では `game_ply` を最終treatmentから外し、starting-playerとrace featuresがoffline valueとplaying strengthの両方を改善した。

---

この記事は、実装・実験記録をもとに、本文の大部分をLLMが執筆し、筆者が内容を確認・編集しています。
