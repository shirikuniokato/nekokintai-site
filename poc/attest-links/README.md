# 端末証明・リンクの独立した試作（#259）

このディレクトリだけを独立した Pages プロジェクトへ配置する。通常のサイトや猫の公開 API には接続しない。

- dev アプリ: `com.ccya.nekokintai.dev`、App ID prefix: `38KMU5TJWZ`
- URL: `https://go-dev.nekokintai.com`
- Pages / D1: `nekokintai-attest-poc`
- API は operator 用の Bearer secret を要求し、2026-10-27 00:00 JST にコード内の期限で停止する。30回/分、challenge は120秒。
- 合言葉の正本は vault の `nekokintai/ATTEST_POC_ACCESS_TOKEN`。ビルド・URL・ログには含めない。
- AASA と assetlinks は公開。リンクコード `POC259` は公開の固定試験データ。

## 検証

`npm ci` → `npm test`。実際の workerd / D1 で署名、counter、再送・競合拒否を確認する。上流 fixture の期限は過去なので、テスト専用 Worker だけが固定時刻を渡す。公開 API は実際の時刻を使う。

App Attest は既存 MIT ライブラリ `node-app-attest@1.0.1` に、証明書・CBOR・credential・環境・counter の検査を追加した。未知の拡張データは拒否する。iOS 27 の category 解析は未実装で、実機観測を終えるまで本番採用を判断しない。

Android の verdict は観測値であり、dev APK を正規ストア版として認証するものではない。Google の解読用認証情報がない場合は503で停止する。

Google の鍵の発行は組織ポリシーで禁止されているため、鍵は作成しない。専用 service account `nekokintai-attest-poc@playconsole-505815.iam.gserviceaccount.com` に対する operator `admin@ncp-tech.com` の Token Creator 権限で、playintegrity scope だけの1時間 tokenを発行する。Worker secrets は `GOOGLE_ACCESS_TOKEN` と `GOOGLE_ACCESS_TOKEN_EXPIRES_AT`。残り60秒で503へ戻る。短期 token は vault に保存しない。

Cloud project `playconsole-505815`（483856818891）は API を有効化済み。dev アプリの Play Console へのリンクは未確認。現在の setup 文書ではリンクは追加設定・テスト・上限増加用の推奨手順だが、実際に解読できるかは実測が必要。https://developer.android.com/google/play/integrity/setup

## 配置

`npm run build` で `public/_worker.js` を作る。`wrangler.json` の D1 は試作専用。既存プロジェクトには配置しない。Worker secret と D1 binding を設定して `wrangler pages deploy public --project-name nekokintai-attest-poc --branch poc/attest-links`。

試作後は Pages の secret・D1 の試験データ・試作ドメイン、専用認証権限を撤去する。App Attest / Associated Domains の dev capability と今回の profile は再利用可。通常版の main / release ブランチへこの試作をマージしない。

## 残る実測

- iOS 実機での attestation / assertion 2回 / replay409、aaguid と flags
- Android 実機またはエミュレータの provider / token / verdict または正確な error code
- Android App Links の verified 状態と HTTPS 起動
- AASA CDN と iOS の Safari からの HTTPS 起動（同一ドメイン内遷移だけでは判断しない）

実測結果: iPhone13 / iOS26.6.1 で `appattestdevelop` の attestation、増加する assertion counter、再送409を確認。Android15 / API35 Google Play エミュレータでは provider・token・Google解読が通り、`app: UNEVALUATED` / `device: []` / `license: UNEVALUATED` / `testing:false`、再送409を観測した。Cloud の基本 API 有効化と scoped token で解読できたが、Play Console のリンク設定はこの試作では確認していない。

App Links は自動 verified となり、Chrome の別ドメインページから HTTPS をタップして dev アプリへ到達、`universal:true` と試験コードを受信。iOS も Safari から HTTPS・カスタムスキームでアプリへ戻れた。どちらもアプリを開く確認が表示されたとの本人確認あり。
