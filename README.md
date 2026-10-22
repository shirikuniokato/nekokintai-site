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
npm run test:api
git push origin main
```

同じ `main` を手動で再デプロイする場合だけ `npm run deploy` を使う。このコマンドは
`main`、クリーンな作業ツリー、`origin/main` と同じHEADの3条件を満たさなければ失敗する。

本体の静的ファイルは `scripts/build-pages.mjs` の許可リストにあるものだけを配信する。
`npm run build` は続けて Pages Functions を `_worker.js` にコンパイルし、
`/api/nekos/*` だけを通す `_routes.json` と一緒に公開物へ入れる。
API は端末証明と入力検査の接続前のため、すべてのメソッドに 503 を返す。
静的なページは従来どおり配信する。
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

## ねこの API の開発（#249）

`feat/neko-api` で基盤から実装中。公開 API はまだ利用できない。

```sh
npm ci
npm run test:api      # ビルドした Functions を workerd で検証
npm run db:check:local # ローカル D1 だけに SELECT 1 を実行
```

`cloudflare/local/wrangler.json` はローカル検証専用。本番・preview の D1 binding や
実 DB の ID を含めず、本番デプロイへ使わない。永続化ファイルは gitignore する。
`npm run db:migrate:local` で保存層のスキーマをローカルだけに適用できる。
保存層の実装範囲と残る接続は [docs/neko-api.md](docs/neko-api.md) を参照。
本番の D1 作成・migration・binding の追加は、#259 の端末証明 PoC の
結果を受けて別途行う。dev と本番は別 DB とし、本番へ証明の素通しを入れない。

Wrangler と Miniflare は版を固定している。Miniflare 5 の公開された
`convertV4MiniflareOptions` でテストの設定を変換する。互換日付は同梱 workerd が
対応する `2026-10-19` に合わせる。ライブラリを更新した場合も、
CI の `test:api` で実際のコンパイル結果・非公開ファイルの境界を確かめる。
