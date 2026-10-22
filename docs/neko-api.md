# ねこ共有 API（#249）

対象: release/2.6.0。保存層・運営 CLI #251 と、既存のサイト画面 #250 を接続する。

## 実装と検証の状態

- 新しい順・累計いいね順（同数は公開日時とidの降順）、直リンク、ほかのねこ、ブロック対象の除外。
- 公開・編集・取り下げ・再公開・世代交換、署名対象の正規化、challenge / counter / 保存を同じ SQL 文で確定する receipt。
- いいねの冪等な追加・取消、投稿/飼い主への通報、重複抑止、通知待ちの同時保存。
- 正本 #245 の code 検査、NFKC / URL / 12 UTF-16文字、4言語の選別語、OGP の glyph pack と同じ文字集合の検査。
- #250 で確定した20か所と英語名、ko / zh-TW の自動名。自動名は初回に決めて保持する。
- 本人決定: **日次カウンターは追加しない。1枠1投稿＋短時間IP制限。にんき順は累計、同数なら新しい順。**
- 既存画面の fetch・いいね・通報を実 API に接続。見た目や導線の再設計は含めない。
- 1匹のHTMLと OGP PNG。名前・code が変わると og:image URL も変わる。非表示/取り下げ後は画像を返さない。画像も no-store とし、以前の応答を自サイトのキャッシュから返さない。SNS 側が既に保存した画像の回収はできない。

開発 Pages: https://nekokintai-sharing-dev.pages.dev （独立プロジェクト・独立 D1・noindex）。
開発用証明省略は別 entrypoint のみ。本番 bundle に `server/development` を入れず、本番 DB も development proof を拒否する。
本番用 D1 と秘密は準備済みだが、本番サイトのデプロイ・共有ブランチへのマージはしていない。

**本番の所有者操作は `OWNER_WRITES_ENABLED` 未設定により503。**
#259 の実機証明と #252 の公開条件を確認した後だけ `verified` に設定する。設定しても暗号学的検証は必須で、省略する本番経路はない。

## 公開 API

すべて `/api/nekos` 以下。同一 origin の Web から使い、CORS の許可は追加しない。JSON API の応答は no-store。

| method / path | 内容 |
| --- | --- |
| `GET /` | `sort=new|popular&page=0&limit=8&hide=<印>,<印>&exclude=<id>` → `{cats, hasMore}` |
| `GET /<id>` | `{cat}`。非公開・ブロック対象・存在しない投稿は404 |
| `PUT /<id>/like` | `{liked: boolean}` → `{likes, liked}`。反転要求ではなく希望状態を送る |
| `POST /<id>/reports` | `{revision, targetKind: publication|owner, reason}` → 202 `{accepted:true}` |

投稿は id / code / breed / colors / name / author / owner（公開用識別子）/ revision / likes / 日時を返す。
private な owner hash、uid 原文、IP 原文、端末の鍵や証明を公開レスポンスへ含めない。
`hide` はアプリが持つブロック一覧。100人まで。API の上限は50件/ページ。

IP は Cloudflare が付ける `CF-Connecting-IP` を秘密付き HMAC にする。ヘッダーをクライアント入力からコピーする独自 proxy は挟まない。
いいねは IP hash×投稿で1件。通報は IP hash×投稿×版×対象で重複を抑止する。
短時間制限は、いいね60回/分、通報3回/10分、所有者操作60回/分。同じIPの共有回線も同じ枠になる。期限切れ bucket は削除する。
通報時点の revision を保存し、本文の複製は持たない。受付後の編集は運営 CLI で版の差から分かる。

## アプリからの操作手順

1. `POST /challenge` に `{uid, purpose:'mutation', platform:'ios'|'android', keyId?, payload}`。
2. 返る `clientData` をそのまま端末証明に結び付ける。Android の `requestHash` は返る SHA-256 hex。
3. `POST /mutation` に `{uid, platform, challengeId:id, clientData, assertion? | token?}`。
4. 成功は `{operationId, action, publication}`。応答を失ったら**同じ要求**を再送する。新しい操作IDで自動上書きしない。

payload の共通項目:

```json
{
  "operationId": "クライアントで生成したUUID",
  "action": "publish",
  "slot": 1,
  "generation": "枠のねこの世代",
  "expectedGeneration": null,
  "expectedRevision": 0,
  "code": "正本の31文字のcode",
  "name": "",
  "author": "",
  "locale": "ja"
}
```

初回は expectedGeneration=null / expectedRevision=0。編集・再公開は直前の generation / revision。
入れ替え時だけ generation を変え、端末の保存・バックアップでも引き継ぐ（#246/#247）。色や code から世代を推測しない。
`withdraw` / `retire` は共通項目の code / name / author / locale が不要。
`read` は operationId / action / slot だけで現在の保存状態を確認する。再送では当時の snapshot を返す。

canonical payload に操作ID・owner hash・全入力・世代/版を含め、clientData は challenge / platform / key / payload digest を含む。
サーバーが正規化して challenge と一緒に保存するため、受信 JSON の ownerHash や fallbackName を信用しない。
challenge は120秒。保存直前にも DB 内で期限・未使用・用途・payload を照合する。

iOS の初回は `purpose:'attest'` と keyId で challenge を取り、`POST /attest` に uid / platform / keyId / challengeId / clientData / attestation。
公開鍵は1 uidにつき複数許可する。証明書・nonce・credential・production AAGUIDを検査し、未知の拡張は拒否する。
以降の assertion は公開鍵と counter で検証する。counter更新と投稿保存が別々に成功する形にはしない。

Android は Play 認識、package、アプリ署名鍵、device integrity、license、requestHash、時刻をすべて検査する。test verdict は本番で拒否する。
生の token / assertion を DB に残さず、再送照合用の digest を保存する。

dev は同じ challenge / mutation 手順で platform を `development` とし、assertion/tokenなし。専用 URL・専用 D1 以外には使わない。

## 環境と秘密

`cloudflare/development/wrangler.json` と `cloudflare/production/wrangler.json` がそれぞれの D1 を指定する。
Pages は custom config path での deploy を受け付けないため、該当ディレクトリから Wrangler を起動する。

```sh
npm ci
npm run test:api
npm run build:development
# Cloudflare の共有 loader で環境変数を設定してから
(cd cloudflare/development && node ../../node_modules/wrangler/bin/wrangler.js pages deploy ../../.pages-dist/development --project-name nekokintai-sharing-dev --branch release/2.6.0)
```

秘密の正本:

| vault item | 注入先 |
| --- | --- |
| `nekokintai/OWNER_PEPPER` / `IP_PEPPER` | 本番 Pages の同名 secret |
| `nekokintai-sharing-dev/OWNER_PEPPER` / `IP_PEPPER` | 開発 Pages の同名 secret |
| `nekokintai/PLAY_INTEGRITY_SA_JSON` | 本番 Pages の同名 secret |
| `nekokintai/NEKOS_SLACK_WEBHOOK_URL` | GitHub Actions の同名 secret |

owner pepper を変えると既存所有者へアクセスできなくなる。通常の secret 更新と同じ感覚で再生成しない。
Play Integrity は専用 SA `nekokintai-integrity` の鍵から、playintegrity scope の10分tokenを作る。publisher の鍵や権限を使わない。
2026-10-23 に本人の許可で、プロジェクト限定の managed key作成禁止を一時解除して発行した。vault保存後にプロジェクト override を削除し、継承される禁止が enforce=true に戻ったことを確認済み。
OAuth と Google decode endpoint の実接続は確認済み。合成の不正 token が Google に400 INVALID_ARGUMENTで拒否されるところまでで、正規端末の verdict 実測は #259。

## 通報通知

通報と `neko_report_notifications` への記録を同じ SQL 文で保存する。
`.github/workflows/notify-neko-reports.yml` が main 上で10分ごとに未送信を処理する。
有効化変数は `NEKOS_NOTIFICATIONS_ENABLED=true`。leaseで並行送信を抑え、失敗は指数バックオフ、最大10回。
Slack が受領した直後に応答が失われると重複通知する可能性がある。正本の通報自体は1件のまま。
理由の自由文・IP・uidは Slack に送らず、通報ID・対象種別・投稿URLだけにする。
手元からの確認と再送は `node scripts/neko-notifications.mjs production <target.json> plan|apply`。
本番の定期実行は workflow が main に入ってから。実 Slack 送信は行わず、成功・失敗・lease競合・再送を模擬送信先で検証した。

## 検証と残る公開条件

`npm test` / `npm run test:browser` / `npm run test:api` / `npm run check:i18n`。
開発環境では `scripts/verify-dev-neko-api.mjs`、`scripts/verify-dev-neko-page.mjs` を再実行できる。
操作 CLI は [neko-operations.md](./neko-operations.md)。

残る本番条件: #259 の署名アプリでの attestation/assertion/replay と Play配布版 verdict、#248 のアプリとの接続、#252 の公開規約・プライバシー・保存期限/完全削除、#250 の未完の画面翻訳・アプリへの反映導線。
これらを API 単体のローカル検証で済んだ扱いにしない。本番で公開する前に、実際の署名・申告・画面との組合せを確認する。
