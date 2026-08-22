# nekokintai-site

ねこ勤怠（https://nekokintai.c-cya.com）の公開ページ。GitHub Pages で配信。

## アプリの更新案内

`update.json` はアプリ内の任意アップデート案内が読む公開情報。
新版がストアから実際に取得できるようになると、nishiokaの `nr cron` が公開ストアを確認し、
公開できたOS側の `latestVersion` と `notes` を自動更新する。審査提出時点では先に進めない。
同期処理の正本はnekokintaiリポジトリの `scripts/sync-store-update.mjs`。

`update-dev.json` はdev版アプリの手動確認専用。nishiokaの
`https://nekokintai.c-cya.dev/update-dev.json` から配信し、表示確認したい版へ自由に進めてよい。
