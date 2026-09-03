# ねこ勤怠LP ローカライゼーション運用

作成日: 2026-09-01（2026-09-04 に `/tip/` `/qa/` `/roadmap/` `/contact/` `/privacy/` を追加し、全ページが対象になった）
対象: トップLP（`/`）、開発をおうえんする（`/tip/`）、よくあるしつもん（`/qa/`）、アップデートのよてい（`/roadmap/`）、ごようぼう（`/contact/`）、プライバシーポリシー（`/privacy/`）
対応言語: 日本語（`ja`）、英語（`en`）、韓国語（`ko`）、台湾向け繁体字中国語（`zh-TW`）

## ページの足しかた

- 辞書はページごと（`assets/lp/locales.json`、`assets/tip/locales.json`、`assets/qa/locales.json`）。ページは `<html data-i18n-source="/assets/<page>/locales.json">` で自分の辞書を指し、`/assets/lp/i18n.mjs` を読む。宣言がなければトップLPの辞書
- ページの一覧と、トップLPで決めた訳をそのまま使うキー（`heading` ＝ LP の `faqLink` など）は `scripts/lib/lp-i18n-pages.mjs` の `I18N_PAGES` と `SHARED_KEYS`。翻訳・監査・逆翻訳のスクリプトは `--page tip` のように対象を選ぶ（省略時はトップLP）。`npm run check:i18n` は全ページを検査する
- リンクを含む文は、リンクの前後で `<span data-i18n>` に分ける（`innerHTML` へ流し込まない）。辞書の値の先頭・末尾の半角スペースはリンクとの区切りなので落とさない
- 画面画像とストアバッジの差し替えはトップLPだけ。差し替える画像のないページでは先読みもしない
- 辞書にないキーは HTML の日本語がそのまま出る（空白にはならない）。翻訳を忘れた項目は他言語の画面に日本語で混ざるので、`npm run check:i18n` で気づく
- JS が組み立てる文言（ロードマップの「ほかの更新内容を N件見る」、ごようぼうの「おくっています…」）は、`hidden` の `<div>` に `data-i18n` の `<span>` として置き、スクリプトはそこから読む。言語が変わると `i18n.mjs` が `nekokintai:locale` イベントで知らせる
- ごようぼうの `<select>` は表示だけ翻訳し、`value`（件名「【ねこ勤怠】こんなのほしい」の元）は日本語のまま
- プライバシーポリシーには「正文は日本語版」の1文を4言語に入れている

## ロードマップを更新するとき（リリースごと）

ロードマップの文言は辞書（`assets/roadmap/locales.json`）にあり、HTML の日本語を書き換えただけでは他言語は変わらない。新しい版のカードを足したら:

1. `<li data-i18n="ios240Item1">` のようにキーを付け、辞書の `ja` にも同じ文を足す（iOS と Android で同じ文は同じキー）
2. `npm run translate:lp-i18n -- --page roadmap <初稿JSON>` → 監査 → `apply:lp-i18n:draft` で他言語を埋める。急ぐときは辞書の他言語に日本語のまま置かず、キーを付けずに出すと日本語のまま表示される（`check:i18n` は失敗するので、あとで必ず訳す）
3. ストア公開を検知する cron の同期（`scripts/lib/roadmap-release.mjs`）は、状態チップを `statusPublished`、公開文を `whenPublished` のキー付きで書き換える。この2つのキーは辞書から消さない

## 方針

アプリ側の [`i18n-localization-guide.md`](../../worktrees/nekokintai/release-2.3.0/docs/i18n-localization-guide.md) と同じ方針を使う。ねこ勤怠のブランド名は翻訳せず、世界観の文章は責めず急かさず、猫語は猫の台詞だけに使う。

- `がんばった貯金` は `Good Job Savings` / `수고 저금` / `辛苦撲滿` に固定する。
- 韓国語は `해요체` を基本とし、変数の前後で助詞が壊れる書き方を採用しない。
- 台湾向け繁体字は台湾華語の語彙を用い、簡体字・中国大陸向けのUI語彙を混ぜない。
- 未翻訳のFAQ、ロードマップ、投げ銭、問い合わせ、プライバシーへのリンクは、各言語で日本語ページであることを示す。

## リソースと検査

- 正本: `assets/lp/locales.json`
- 言語解決: `assets/lp/locale.mjs`
- ブラウザ反映: `assets/lp/i18n.mjs`
- 決定的検査: `npm run check:i18n`

翻訳が用語集外の文章を含む場合は、初稿をそのまま公開しない。以下の監査記録を `docs/lp-i18n-eval/YYYY-MM-DD/` に残す。

1. Gemini 3.1 Pro で全言語の初稿を生成する（`npm run translate:lp-i18n -- [--page tip|qa] <初稿JSON>`。40文言ずつ分けて頼み、改行数が合わないキーだけ頼み直す）。
2. Claude Fable と Codex が、初稿を独立して監査する（`npm run audit:lp-i18n -- [--page …] claude-fable <初稿JSON> <Fable監査JSON>`、`npm run audit:lp-i18n -- [--page …] gpt <初稿JSON> <Codex監査JSON>`）。
3. 指摘をレビューして採用し、ロケール正本へ反映する（トップLPの初回は `npm run apply:lp-i18n`。それ以降の回は、採用した指摘を `docs/lp-i18n-eval/YYYY-MM-DD/` の README に残して反映する）。トップLPと共通のキーは `applySharedTranslations` で LP の訳に置き換える。
4. 最終文面を各言語から日本語へ戻して原文との意味差を監査する（`npm run audit:lp-i18n:reverse -- [--page …] <逆翻訳監査JSON>`）。critical / high が残る場合は修正し、再実行する。

検査では、キー集合、空文字、意図した改行数、翻訳漏れの日本語、禁止語、韓国語の助詞併記、固有機能名を確認する。言語は URL の `?lang=`、保存済み設定、端末言語の順で決め、日本語をフォールバックにする。

## 公開前の確認

1. `npm run check:i18n && npm test && npm run build && npm run test:browser` を実行する（`test:browser` は Playwright の Chromium で言語ボタンのクリック切替を検査する。初回は `npm install`）。
2. `nr app deploy nekokintai-preview /home/rikuto/git/nekokintai-site --static --domain nekokintai.dev` で検証環境へ反映する。
3. `nekokintai.dev/?lang=en`、`?lang=ko`、`?lang=zh-TW` をPC・スマートフォン幅で確認する。加えて日本語で開いてから言語ボタンをクリックし、本文と同時に4枚のアプリ画面と App Store / Google Play バッジが切り替わること、日本語以外の Google Play バッジ本体が日本語と同じ大きさに見えることを確認する。
   アプリ画面の撮り方と週画面の日付合わせは [`docs/lp-screenshots/README.md`](../docs/lp-screenshots/README.md)。
4. 3言語それぞれを、翻訳に参加していないネイティブ話者または独立モデルで、意味・世界観・自然さ・用語・UI幅の観点から確認する。画面幅と折り返しは視覚対応モデルまたは人が実画面で確認する。
5. 重大な指摘がなければ、コミットしてCloudflare Pagesの本番デプロイへ進む。
