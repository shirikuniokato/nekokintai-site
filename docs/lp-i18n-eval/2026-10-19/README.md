# よくあるしつもん 2.5.0 対応の多言語化 2026-10-19

2.5.0 で入る「きっちり表示」「横画面」「じぶんだけのねこ（買い切り枠）」「目標の 30 分きざみ」に合わせて、
`/qa/` の 18 キーを直した（新規 11・書き換え 7・削除 5）。本番デプロイは**両ストアで 2.5.0 が公開されてから**
（QA は OS で分かれていないため、片方だけ先に出すと公開前の機能を案内してしまう）。

## 変更したキー

- 新規（できること）: `howTo22*`（6.9h → 6時間54分の切りかえ）、`howTo23*`（横画面）、`howTo24*`（毛色や目の色＝じぶんだけのねこ）
- 新規（これからのこと）: `upcoming13*`（多頭飼い。枠は 10 まで・歩くのは相棒の 1 匹）
- 書き換え: `howTo14Note`（30 分きざみ）、`supporter1Answer` / `supporter4Answer`（おうえんプランの枠）、
  `supporter3Question` / `supporter3Answer` / `supporter3Note`（買った枠の復元・同じ OS・見た目はバックアップ）、`upcoming3Answer`（買い切り枠）
- 削除: `upcoming1*`（6.9h の要望。できることへ移した）、`upcoming4*`（毛色・多頭飼い。2 つに分けた）

## 初稿

`qa-gemini-full.json` は Gemini（gemini-3.1-pro-preview）が全 160 キーを訳したもの。アプリの実ラベルとずれていた箇所
（Your own cats / 나만의 고양이 / 專屬貓咪、slot = 칸 / 名額、Restore purchased slots、Create a cat、Time display、Precise / Relaxed、
Support plan / 응원 플랜 / 支持方案、Cat shop、companion = 단짝 / 夥伴）を手で直し、変更キー以外は公開済みの訳を並べたのが `qa-draft.json`。

## 監査で採用したもの（`qa-adopted.json`）

- 変更キー: zh-TW `howTo23Answer` の「切換作業 → 切換工作項目」（Fable）、zh-TW `supporter1Answer` の「2 匹を同時に相棒」と読める箇所（Fable）、
  ko `supporter3Answer` の条件節の接続（Codex）
- 公開済みキー: en の一人称 We → I（`investigating1Answer` / `upcoming2Answer`）、zh-TW `upcoming2Answer` の「我們」と「每個星期幾」、
  en `howTo12Answer` の "Week" 画面名、ko `upcoming2Answer` の助詞、zh-TW `howTo5Answer`（計算 → 記錄・熬夜 → 跨夜工作）、
  `howTo17Answer`（「下班」をボタン操作と明示）、`howTo19Answer`（iOS 16 の端末ではなく小工具が出ない）、`howTo19Note`、`unlikely5Note`

## 採用しなかったもの

- en `supporter2Answer` の "Choose" → "Set as companion"（Fable・Codex の両方が high）: アプリの「相棒にする」ボタンの英語表記が `Choose` なので、画面で探せる表記を優先
- ko `howTo24Answer` の「젖소무늬 → 턱시도」（Codex high）: アプリの「ハチワレ」の韓国語ラベルが `젖소무늬`（タキシードは別の柄として `턱시도` がある）
- ko `howTo12Answer` の「주 화면 → 주간 화면」: アプリの週タブは `주`
- en `howTo2Answer` の引用文 "Clock-out wasn't recorded.": アプリにその文言は無い

## 逆翻訳の監査

`qa-reverse-audit.json`（Codex）: 0 件。

そのあと、スマホ幅（390px）の実表示で `supporter3Answer`（ja・ko・zh-TW）と zh-TW `howTo24Answer` の末尾が 1〜2 文字だけ孤立していたので、
意味を変えずに改行位置だけ組み直した（ja は 8 行 → 9 行。3 言語は `qa-adopted.json` の `manual`）。逆翻訳の再実行はしていない。
