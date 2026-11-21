# ロードマップ 2.6.2 のカード（たいおうちゅう）2026-11-21

2.6.2 の審査提出（2026-11-21、iOS / Android）に合わせ、`/roadmap/` の iOS / Android の両方の列に、2.6.1 のカードの上へ「たいおうちゅう」のカードを足した（`statusInProgress` / `whenInProgress`）。
公開後の「こうかいずみ」への切り替えは cron の `sync-store-update` に任せる。

## 日本語の正本

ストアのリリースノート（`nekokintai/docs/store/releases/2.6.2/copy.ja.json` の `releaseNotes` / `whatsNew`。本人 OK 済み、両 OS 同じ文）を 1 項目ずつキーにした。iOS と Android で同じ文なので、3 キーとも両方の列で共有する。

- `v262Item1` 横画面にすると、作業が勝手に切りかわることがある不具合を直しました
- `v262Item2` じぶんだけのねこの「しま」で、首輪の色がえらんだ色にならない不具合を直しました。すでにおむかえした「しま」の子は、首輪がえらんである色に変わります
- `v262Item3` ふわふわのねこの輪郭が、ねこ屋さんなどで少し切れていたのを直しました

改行は 1 行 10〜18 字ほど。1 と 3 は 3 行、2 は 5 行。

## 訳の出どころと顔ぶれ（標準の手順から外れた点あり。2.6.1 と同じ形）

- en / ko / zh-TW: ストアの確定訳（`nekokintai/docs/store/releases/2.6.2/i18n-eval/`。監査・逆翻訳済み）に、ja と同じ行数の改行を入れたもの。語は変えていない（空白と改行を除いて同じ文であることを機械的に照合した）
- zh-Hans: **初稿は Claude Opus 5.5（`claude-opus-5-5`）が書いた。** Gemini が `HTTP 402`（前払い残高切れ）で使えないため（同じ日にストア文言の `draft` で確かめた）。
  この作業のセッションの primary は Claude Fable で、Fable は監査を受け持つので、primary が別モデル（Opus）の subagent を起こして書かせた。`roadmap-draft.json` の `zhHansNewKeysBy` に記録
  - 用語はアプリの実ラベル（`release-2.6.2` の `src/app/i18n/locales/zh-Hans.json`）: 专属猫咪・虎斑・项圈（`customCat`）、猫咪小铺（設定の入口）、蓬蓬（ねこの名前）、迎接（`customCat.entranceHint`）
  - 横向きはこのページの既存の訳（将设备横过来）、「画面」は既存の訳（页面）に合わせた
  - 2 の 2 文目は「最初にえらんだ色」と読めないよう「当前所选的颜色」にした（ストアの zh-TW で監査が指摘した点と同じ）
- draft: 2.6.1 と同じく mixed（既存キーは今の辞書の値、新 3 キーは上記）。`apply:lp-i18n:draft` 適用後の辞書の差分が新 3 キーだけであることを確かめた（5 言語とも）
- **初稿（Opus）と Fable の監査はどちらも Anthropic 系**。Codex（gpt-5.6-sol）の監査と逆翻訳が別系統

## 監査

3 キー × 4 言語を、公開ずみのキーと一緒にページ全体として監査（`--locales en,ko,zh-TW,zh-Hans`）。

- Fable `claude-fable-5`（`roadmap-audit-fable.json`）: 28 件。新キーへの指摘は 0 件
- Codex `gpt-5.6-sol`（`roadmap-audit-codex.json`）: 21 件。新キーへの指摘は 0 件
- 逆翻訳 `gpt-5.6-sol`（`roadmap-reverse-audit.json`）: 2 件（すべて medium、critical / high なし）。新キーへの指摘は 0 件

**採用は 0 件**（`roadmap-adopted.json`）。新キー以外への指摘（公開中の訳）は今回の範囲外で、変えていない（2.5.2・2.6.0・2.6.1 と同じ扱い）。

## 確認

`npm run check:i18n`・`npm test`（100 件）・`npm run build`・`npm run test:browser`（26 件）を通した。
build 後の `.pages-dist/site` を Playwright（390px 幅）で開き、5 言語の 2.6.2 のカード（iOS の列）を撮って確かめた。1 文字だけが次の行に落ちる行は無い。Android の列は同じキーのカードで、HTML に入っていることを確かめた。
