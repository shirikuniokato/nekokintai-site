# nekokintai-site

ねこ勤怠（https://nekokintai.com）の公開ページ。Cloudflare Pages の `nekokintai` プロジェクトで配信。
旧URLの `https://nekokintai.c-cya.com` は、Cloudflareの証明書が有効になったあと
`nekokintai-legacy` プロジェクトからパスを保ったまま新URLへ一時リダイレクトする。

## デプロイ

Cloudflareの共通トークンを読み込み、Wranglerで直接アップロードする。

```sh
source ~/.config/cloudflare/load.sh
pnpm dlx wrangler@4 pages deploy . --project-name=nekokintai --branch=main
pnpm dlx wrangler@4 pages deploy cloudflare/legacy-redirect --project-name=nekokintai-legacy --branch=main
```

本体をデプロイするとき、`cloudflare/legacy-redirect` は本体サイト内にもアップロードされるが、
`_redirects` はサブディレクトリ内なので本体のルーティングには影響しない。

## アプリの更新案内

`update.json` はアプリ内の任意アップデート案内が読む公開情報。
新版がストアから実際に取得できるようになると、nishiokaの `nr cron` が公開ストアを確認し、
公開できたOS側の `latestVersion` と `notes` に加え、`roadmap` の同じバージョンの状態も自動更新する。審査提出時点では先に進めない。
ストアが一時的に古いバージョンを返しても、公開済みの更新案内は後退させない。
`roadmap` に公開版のカードがない場合は、更新内容を推測で追加せず同期を失敗させてSlackへ通知する。
同期処理の正本はnekokintaiリポジトリの `scripts/sync-store-update.mjs`。

`update-dev.json` はdev版アプリの手動確認専用。nishiokaの
`https://nekokintai.c-cya.dev/update-dev.json` から配信し、表示確認したい版へ自由に進めてよい。
