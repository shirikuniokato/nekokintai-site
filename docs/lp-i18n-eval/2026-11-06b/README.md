# ロードマップ 2.5.2 のカード（たいおうちゅう）2026-11-06

2.5.2 を両ストアへ審査に出したのに合わせ、`/roadmap/` の iOS / Android の両方の列に「たいおうちゅう」のカードを足した。
公開後の「こうかいずみ」への切り替えは cron の `sync-store-update` に任せる。

## 日本語の正本

ストアのリリースノート（`nekokintai/docs/store/releases/2.5.2/copy.ja.json` の `whatsNew` / `releaseNotes`。本人 OK 済み）を、2.5.1 のカードと同じ粒度で 1 項目ずつキーにした。iOS と Android で同じ文は同じキー:

- `v252Item1` 中国語（簡体字）に対応しました（両方）
- `ios252Item1` ウィジェットやロック画面の表示を直しました（iOS）
- `android252Item1` ウィジェットや通知から退勤しても記録に入らないことがあったのを直しました（Android）
- `v252Item2` 特定の状況下で記録の時間がずれることがあったのを直しました（両方）

## 訳の出どころと顔ぶれ

- en / ko / zh-TW: ストアの訳（同ディレクトリの `i18n-eval/`。Gemini 初稿 → Fable 監査 → Sol 監査 → 逆翻訳の監査済み）に、ja と同じ位置の改行を入れたもの
- zh-Hans: ストアに簡体字の文面が無いので、Gemini `gemini-3.1-pro-preview` の初稿（`roadmap-gemini-zh-hans.json`）。アプリの実ラベルへ 1 か所直した（锁屏画面 → 锁定屏幕）。
  言語名はアプリの設定画面と同じ「简体中文」で「新增支持简体中文」
- 監査: 4 キー × 4 言語を、公開ずみのキーと一緒にページ全体として Claude Fable `claude-fable-5` と GPT `gpt-5.6-sol` が独立に監査（`roadmap-audit-fable.json` / `roadmap-audit-codex.json`、`--locales en,ko,zh-TW,zh-Hans`）。
  **4 キーへの指摘はどちらも 0 件。** 公開ずみのキーへの指摘（Fable 21・Codex 24、high は en `android110Item3`・zh-TW `v240Item4`）は今回の範囲外で、公開中の訳は変えていない（2026-09-04 の LP と同じ扱い）
- 採用: `roadmap-adopted.json`（採用・手直しなし。draft の 4 キーをそのまま反映）
- 逆翻訳: GPT `gpt-5.6-sol`（`roadmap-reverse-audit.json`、4 言語）

## 確認

`npm run check:i18n`・`npm test`・`npm run test:browser`・`npm run build` を通し、一時プレビューで /roadmap/ と /zh-Hans/roadmap/ の実画面を見た。
