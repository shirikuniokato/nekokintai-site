# nekokintai-site

ねこ勤怠（https://nekokintai.com）の公開ページ。Cloudflare Pages の `nekokintai` プロジェクトで配信。
旧URLの `https://nekokintai.c-cya.com` は、`nekokintai-legacy` プロジェクトから
パスを保ったまま新URLへ恒久リダイレクトする。

## デプロイ

`main` へのpushでGitHub Actionsがテストと公開ファイルの生成を行い、Wranglerでアップロードする。
本番の正本は必ず `main` とし、未コミットの作業ツリーからWranglerで直接デプロイしない。
手元では次のコマンドで確認してから、変更をコミットして `main` へpushする。

```sh
node --test scripts/lib/*.test.mjs
node scripts/build-pages.mjs
git push origin main
```

同じ `main` を手動で再デプロイする場合だけ `npm run deploy` を使う。このコマンドは
`main`、クリーンな作業ツリー、`origin/main` と同じHEADの3条件を満たさなければ失敗する。

本体は `scripts/build-pages.mjs` の許可リストにある静的ファイルだけを配信する。
同期スクリプト、テスト、GitHub Actions、旧ドメイン用プロジェクトのファイルは本体へアップロードしない。

## アプリの更新案内

`update.json` はアプリ内の任意アップデート案内が読む公開情報。
新版がストアから実際に取得できるようになると、nishiokaの `nr cron` が
App StoreとGoogle Playの商品ページを確認し、
公開できたOS側の `latestVersion` と `notes` に加え、`roadmap` の同じバージョンの状態も自動更新する。審査提出時点では先に進めない。
ストアが一時的に古いバージョンを返しても、公開済みの更新案内は後退させない。
`roadmap` に公開版のカードがない場合は、更新内容を推測で追加せず同期を失敗させてSlackへ通知する。
差分がある場合は対象ファイルをGitHub上の1コミットにまとめ、pushで起動する1回のデプロイを待つ。
差分がない場合は本番デプロイを待たず、そのまま正常終了する。
同期処理の正本はこのリポジトリの `scripts/sync-store-update.mjs`。

```sh
npm run sync-store-update:dry-run
npm run sync-store-update
```

`update-dev.json` はdev版アプリの手動確認専用。nishiokaの
`https://nekokintai.c-cya.dev/update-dev.json` から配信し、表示確認したい版へ自由に進めてよい。
