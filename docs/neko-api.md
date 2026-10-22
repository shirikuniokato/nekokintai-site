# ねこの API の実装状況（#249）

対象: `feat/neko-api` / [アプリ側の仕様](https://github.com/shirikuniokato/nekokintai/blob/release/2.6.0/docs/design/cat-share/README.md)。
この文書は公開 HTTP API の完成した契約ではなく、ローカルで検証している保存層の引き継ぎ。
本番へのマージ・デプロイ・D1 作成はまだ行わない。

## 実装した範囲

- Pages Functions のコンパイルと API 専用のルーティング、静的ファイルの許可リスト。
- ローカル D1 のスキーマ、投稿・編集・取り下げ・再公開・枠の入れ替え、いいね・取消、新しい順の取得。
- 運営の非表示、飼い主の投稿停止、利用者のブロックが読み取り・更新に適用される条件。
- 名前2つの NFKC・制御文字整理、UTF-16 の12文字上限、URL 拒否、語ごとの全体/単語境界/部分一致。
- LDNOOBW の4言語の元データ。これは選別前のデータで、受付に使う辞書は未作成。

`functions/api/nekos/[[path]].js` は現在すべて 503 を返す。下記の保存関数へ繋ぐ認証済みの HTTP ハンドラはまだない。
本番の証明省略フラグや、クライアントが owner_hash を渡して操作する API は作らない。

## 保存関数の呼び出し条件

`registerOwner` / `publishPublication` 等は内部の保存関数。受信 JSON をそのまま渡す場所ではない。
端末証明が確かめた利用者に対応する ownerHash をサーバーで求め、検査済みの code・名前・時刻を渡す。
uid と IP の原文は DB に入れない。公開用 token は private な ownerHash とは別にする。
HMAC の鍵や生成処理はまだ接続していない。

`publishPublication` へは、枠番号、ねこの世代 generation、クライアントが知っている直前の expectedGeneration / expectedRevision を渡す。
初回だけ expectedGeneration=null / expectedRevision=0。同じ世代の再公開・編集は同じ id を維持し、世代が変わったときはサーバーが新しい id を作る。
公開・編集・取り下げ等で revision が進むので、古い編集要求は conflict になる。conflict のまま自動的に上書きしない。
成功した応答が失われた場合も再送は conflict になる。`readCurrentPublication` で自分の世代・版・保存内容を読み直して照合できるが、認証済みの読み直し用 HTTP 導線か、署名対象の操作 ID による再試行の仕組みを接続するまで公開しない。

**アプリ側への依存:** generation はねこの色や code から推測できない。枠のねこを入れ替えたときだけ変わる識別子をアプリで保持し、バックアップでも引き継ぐ必要がある。
取り込みで入れ替えた時点で `retirePublication` 相当の通知を行い、その後も旧世代の行と枠の履歴を残す。
認証済みのリクエストに generation・revision・操作内容をどう結びつけるかは #259 の結果を受けて決める。

fallbackName はサーバーが確認済みの場所一覧から初回に決める内部の値。クライアントの任意文字列を使わない。
いったん保存した fallback_name は再公開で引き継ぐ。利用者の入力名が空ならこの名前を使う。
4言語の全候補の確定・語の確認と、自動命名の接続は残っている。

運営による1投稿の非表示と、飼い主の停止は別の状態。前者だけでは別の世代の公開まで禁止しない。悪用者の再投稿を止める措置では、#251 の運営スクリプトで飼い主の停止も行う。

## 同時実行

- 既存の編集は、現在の枠・revision・非表示/停止の条件を1つの UPDATE 内で確認する。
- 新規/入れ替えは、現在の枠と revision を条件に INSERT し、枠の更新・旧投稿の終了を D1.batch のトランザクションで行う。
- いいねは「追加する/取り消す」を指定する。再試行で反転する toggle にはしない。投稿×IPハッシュの一意制約で重複を防ぎ、数は行から導く。
- 新しい順は公開日時と id の組でページを進める。ブロック済み飼い主は一覧と直リンクで除外できる。

これらは challenge の消費・App Attest の counter とはまだ同一の原子的処理になっていない。
#259 の前に実サービスへ繋いでよい、という意味ではない。

## 検証

```sh
npm run test:api       # 公開ビルドの境界と、実際の workerd/D1 上の保存処理
npm run db:migrate:local
npm run db:check:local
```

本番/preview の migration や、dev client 用の証明を省略する環境はここでは作成しない。
ローカル設定は `cloudflare/local/wrangler.json` だけを使う。

## 残っている範囲

1. #259 の App Attest / Play Integrity PoC。verified principal、challenge・counter・再試行と保存の原子的な境界。
2. #245 の正本の code 検査の取り込み。保存層は検査済み code を受ける前提で、31文字であることだけを DB でも確認している。
3. 名前の実辞書の選別と4言語の内容確認、自動名の4言語の候補。全体一致等の検査だけで網羅性を主張しない。
4. uid ごとの投稿回数・IP 制限の値と実装、にんき順の期間・計算の決定。
5. 投稿・閲覧・いいね・通報等の HTTP ハンドラ、通報データと Slack 通知の再試行、運営操作用の接続。
6. 本番と dev の別 D1・binding・secrets、保存期間/完全削除等の #252 の方針、実環境での検証。

上記がそろうまで #249 は未完了、PR は draft のままにする。

## 運営操作の追加

運営 CLI と追加 migration の手順・保存契約は [neko-operations.md](./neko-operations.md) を参照。
`0002_neko_operations.sql` 適用後の公開処理は全体停止と永久公開終了の条件を SQL 内で確認する。
