# ねこ共有の運営スクリプト

対象: アプリ repo の #251。API 保存層 #249 の上に追加する。管理画面・管理用 HTTP API は作らない。

## 準備

```sh
npm ci
npm run db:migrate:local
npm run neko:ops -- --help
npm run neko:ops -- status --environment local
```

local は `cloudflare/local/wrangler.json` の D1 を Wrangler 経由で使う。既定の保存先も `db:migrate:local` と共通。
テスト用に分ける場合は、migration と CLI の両方に同じ `--persist-to /絶対パス` を渡す。
CLI は migration を自動適用しない。remote の D1 作成・migration・API 配線は #249 で行う。

## 確認と操作

コマンドは JSON を出力する。投稿・通報の入力文字列も JSON の文字列として表示する。
版番号を読み、対象と理由を確認してから適用する。数字は例なので、確認結果の値に置き換える。

```sh
npm run neko:ops -- reports --environment local --limit 50
npm run neko:ops -- reports --environment local --after 50 --limit 50
npm run neko:ops -- publication --environment local --target 投稿ID
npm run neko:ops -- owner --environment local --target 飼い主の公開識別子

# --apply がなければ計画のみ。操作IDを控え、同じ引数で --apply を追加する。
npm run neko:ops -- hide --environment local --target 投稿ID --revision 1 --reason '通報内容を確認中' --actor 担当者 --operation-id 一意な操作ID
npm run neko:ops -- hide --environment local --target 投稿ID --revision 1 --reason '通報内容を確認中' --actor 担当者 --operation-id 一意な操作ID --apply
npm run neko:ops -- audit --environment local --operation-id 一意な操作ID
```

| コマンド | target | 確認する版 | 効果 |
| --- | --- | --- | --- |
| `hide` / `unhide` | 投稿ID | publication の `revision` | その投稿の非表示・解除 |
| `remove` | 投稿ID | publication の `revision` | その世代の永久公開終了。解除不可 |
| `suspend` / `unsuspend` | 飼い主の公開識別子 | owner の `revision`（投稿・通報一覧では `owner_revision`） | 全投稿の非表示と、別枠・別世代を含む投稿受付停止・解除 |
| `pause` / `resume` | `publishing`（省略可） | status の `revision` | 全体の新規投稿・編集・再公開・交換の停止・再開 |
| `resolve` | 通報ID | report の `revision` | 通報を処理済みにする。投稿状態は変えない |

通報一覧は既定で未処理のみ。次ページには最後の `id` を `--after` で渡す。
`--include-resolved` で処理済みも確認できる。
`publication_revision` と `current_publication_revision` が異なれば、受付後に編集・状態変更されている。
通報理由・現在の投稿・現在の版を確認してから操作し、処理済みにする。

全体停止中も閲覧・取り下げ・運営操作は可能。停止設定が欠けた場合は投稿を許可しない。
投稿の非表示と飼い主停止は独立しており、一方の解除では他方を解除しない。
投稿単位の `remove` だけでは別世代の投稿を止めない。継続的な違反には `suspend` を使う。

## remote 接続

対象ファイルは Cloudflare 上で作成済みの D1 の情報から用意する。dev と production は別ファイル・別 DB にする。
スクリプトは指定環境とファイルの `environment`、取得した D1 の名前・ID が一致するか確認する。
名前から環境を推測しないため、承認済みの対象情報を設定すること。

```json
{
  "environment": "dev",
  "accountId": "Cloudflare の account ID（32桁の小文字16進数）",
  "databaseId": "D1 の UUID",
  "databaseName": "D1 の実際の名前"
}
```

共有 Cloudflare token の読込手順で `CLOUDFLARE_API_TOKEN` を設定し、次の形式で実行する。
token は設定ファイル・引数・標準出力に含めない。必要権限は対象アカウントの D1 Read / D1 Write。

```sh
source ~/.config/cloudflare/load.sh
npm run neko:ops -- status --environment dev --target-config /絶対パス/neko-dev.json
npm run neko:ops -- pause --environment dev --target-config /絶対パス/neko-dev.json --revision 1 --reason '緊急停止' --actor 担当者 --operation-id 一意な操作ID --apply
```

計画出力は接続・変更をしない。実適用・確認コマンドでは DB の実情報を照合する。
remote の変更は REST の単一 SQL 文で行い、複数 HTTP 要求による変更の分割や自動再試行はしない。
bind パラメータは [Cloudflare REST の仕様](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/) に合わせて文字列配列に変換する。版・件数は SQLite の整数列・LIMIT で照合する。

## 保存層との契約

`0002_neko_operations.sql` を `0001_nekos.sql` の後に適用する。

- 投稿の `deleted_at` を可視性・同世代の再公開禁止に含める。既存の公開判定を共通利用する、一覧・直リンク・いいねも対象。
- 投稿 INSERT / 同世代 UPDATE の SQL 内で `neko_settings(id=1).publishing_paused=0` を確認する。事前の SELECT だけに頼らない。
- 運営操作は `neko_operations` への INSERT が入口。trigger が版番号と状態を確認し、対象更新と操作記録を同じ SQL 文として確定する。競合なら両方を取り消す。
- 投稿操作は投稿の `revision`、飼い主操作は `moderation_revision`、全体設定と通報操作は各 `revision` を増やす。
- 時刻は Unix epoch のミリ秒。運営操作は DB が時刻を付け、CLI では時刻を指定しない。
- 通報受付 #249 は `neko_reports(publication_id, publication_revision, target_kind, reason, created_at)` を保存する。`target_kind` は `publication` / `owner`。投稿者は投稿 JOIN で確定し、別の owner 入力を受け取らない。
- 通報時の投稿版を保存するが本文は複製しない。受付時の版が現在の版と一致することは受付側の SQL でも確認する。理由は trim 後 1〜500 文字。受付の証明・レート制限・Slack 通知は #249 の範囲。

応答を失ったら、エラーに出る操作IDを `audit` で検索する。
同じ ID・内容で実行すると既存記録を返す。別の内容なら拒否する。
新しい ID での盲目的な再送はせず、現在の版・状態を確認する。
操作記録には操作者と理由が残るが、同じ DB 書込権限による直接 SQL の改ざんを防ぐ仕組みではない。

## 削除の境界と残作業

`remove` は公開終了のための論理削除。投稿内容・いいね・飼い主・通報・操作記録を保持し、取り下げ後も同じ世代を再公開させない。
個人情報の消去請求に対する物理削除ではない。本文・いいね・識別子・通報・監査・バックアップの保存期限と消去方法、証明を失った人の本人確認は #252 で決める。

検証はローカル Miniflare D1 と Wrangler local。remote transport は模擬応答で検証する。
dev / production D1 は未作成・未適用で、実リソースへの疎通・運営操作は未確認。#249 の環境構築後に staging で確認する。

```sh
npm test
npm run test:api
```
