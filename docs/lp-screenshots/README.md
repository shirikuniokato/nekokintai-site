# LP 多言語アプリ画面

LPのアプリ画面は、本文と同じロケールの実アプリから撮る。日本語の画面を画像編集で翻訳してはいけない。画像に文字を合成することも禁止。

## ファイル

| 置き場所 | 中身 |
|---|---|
| `demo/<locale>-<align>-<撮影日>.json` | アプリへ読み込むデモデータ（`scripts/prepare-lp-screenshot-demo.mjs` の出力。`today` と `week` の2種） |
| `sources/<locale>/screen-{home,week,month,shop}.png` | 実アプリの撮影素材 960×1634（`store-screenshot.sh capture` の出力） |
| `hariko-renders-v2.3.0-dev.json` | hariko のアセット・レンダー ID（`scripts/render-lp-localized-screenshots.mjs` が書く） |
| `../../assets/lp/screenshots/<locale>/screen-*.png` | LP に出す 720×1205（同スクリプトの出力） |

日本語の `assets/lp/screen-*.png` は従来どおりストア提出画像から作る（`scripts/rebuild-lp-screenshots.sh`）。

## デモデータと日付合わせ

デモデータの正本は `~/git/nekokintai/docs/store/screenshots/demo-data.json`。達成した週は 2026-08-03（月）〜 08-09 で、
最後の出勤日は 08-07（金）。週の合計は 26.4h / 25h で、日本語の週画面はこの週を写している。

`scripts/prepare-lp-screenshot-demo.mjs` はカテゴリ名と猫名だけを翻訳し、勤務内容・目標・猫の順番は全言語で同一に保つ。
勤務記録の日付は撮影日に合わせてずらすが、**何日ずらすかを手で決めない**。目的で選ぶ。

| `--align` | ずらし方 | 使う画面 |
|---|---|---|
| `today` | 最後の出勤日（08-07）を `--on` の日に重ねる | ホーム・月・ねこ屋さん |
| `week` | 達成した週（08-03〜）を `--on` の日を含む週に重ねる | 週 |
| `none` | ずらさない | 日本語の再現・検証用 |

**週画面に `today` を使ってはいけない。** 2026-09-02（水）の撮影では `today` 合わせ（+26日）で撮ったため、今週に入る勤務が
月〜水の3日ぶん（13.4h）しかなく、en / ko / zh-TW の週画面が未達成のまま LP に載った。週画面は「今週」しか出せない
（前の週へ移動できない）ので、達成した週をまるごと今週に重ねる `week` 合わせが必要になる。週の後半の打刻が撮影日より先に
なっても、閉じた打刻は集計に入る（`src/shared/segments.ts` の `buildSegments` は退勤で閉じた区間を現在時刻で切らない）ので、曜日にかかわらず
26.4h の達成週になる。ホームは「きょう」の記録を見せる画面なので、こちらは `today` 合わせのままにする。

```sh
# 撮影日 2026-09-02 の例。各言語で2つ作る
npm run prepare:lp-screenshot-demo -- en docs/lp-screenshots/demo/en-today-2026-09-02.json --align=today --on=2026-09-02
npm run prepare:lp-screenshot-demo -- en docs/lp-screenshots/demo/en-week-2026-09-02.json --align=week --on=2026-09-02
```

2026-09-02 の撮影では、ホーム・月・ねこ屋さんは `today` 合わせ（+26日）、週は `week` 合わせ（+28日）で撮った。
週画面は撮影日（水）より先の木・金の打刻も集計に入り、3言語とも 26.4h / 25h・達成 4日・リボンが出ている。
撮影日より先の日があるぶん、一覧の上に「これから来る日は先に休みにできる」の案内文が出る。これは実アプリの表示そのもので、
日本語画像（週が終わってから撮ったもの）にはない行。

## 撮影手順（言語ごと）

撮影は `~/git/nekokintai` の `scripts/store-screenshot.sh` を使う。開発プレビュー用は `dev`、ストア・本番LP用は提出対象と同じ
本番ビルドを `prod` で。`capture` は撮影後にエミュレータの画面設定を必ず戻すので、**1枚ごとに `prepare` からやり直す**。

1. `scripts/emu.sh up` → 対象ビルドを `scripts/emu.sh install <apk>` で入れる。言語は端末設定を変えずに、アプリの
   設定 → その他の設定 → 言語 で選べる（2.3.0 のアプリ内言語設定）。撮り終えたら「自動」に戻す。
2. `today` 合わせの JSON を `adb push` で `/sdcard/Download/` へ送り、アプリの 設定 → バックアップはこちら →
   バックアップからもどす → ファイルを選ぶ で読み込む。復元は `prepare` の前（通常の画面サイズ）で行う。
3. `scripts/store-screenshot.sh prepare dev` → ホームへ → `capture docs/lp-screenshots/sources/<locale>/screen-home.png dev`
   （パスはサイトリポジトリからの絶対パスで渡す）。月・ねこ屋さんも同じく `prepare` → 画面へ移動 → `capture`。
   `capture` のあとはアプリが前面から消えるので、次の操作の前に `scripts/emu.sh open` で開き直す（ランチャーを誤タップしやすい）。
4. `week` 合わせの JSON を同じ手順で読み込み直し、`prepare dev` → 週タブ → `capture .../screen-week.png dev`。
5. サイトリポジトリで `npm run render:lp-localized-screenshots -- <locale> [--screens=week]`。hariko の
   `nekokintai-store-screenshot` テンプレで合成し、原本の外枠が 1px も変わっていないことを機械検査してから 720×1205 の
   LP 画像を作る。`--screens=` で撮り直した画面だけに絞れ、`hariko-renders-v2.3.0-dev.json` は他の言語・画面の記録を
   保ったまま更新される。
6. 原寸で目視する。週画面は日本語の `assets/lp/screen-week.png` と同じく、リボン（たっせい相当）・26.4h / 25h・達成 4日 が出ていること。

## LP 側の確認

1. `npm test && npm run check:i18n && npm run build`
2. `npm run test:browser`（要 `npm install`。Playwright の Chromium で `/` を日本語で開き、言語ボタンを ja → en → ko → zh-TW → ja と
   **クリック** して、本文・4枚の画面・App Store / Google Play バッジの `src` と原寸、画素の指紋が同時に切り替わることを
   PC 幅とスマートフォン幅で検査する）。`?lang=` の直打ちだけで済ませない。切り替え後の画像は先読みしてあるので、
   読み込み待ちで前の言語の画像が残らない。
3. 日本語以外の Google Play バッジ本体の高さが日本語と同じで、App Store バッジとの間隔も同じであること。
   公式 PNG の透明余白は言語で違う（en は四辺 41px、ko / zh-TW は上下 29px・左右 0）ので、`index.html` の `.store-badges` は
   言語ごとに実測値で打ち消している。実測は `npm run measure:lp-badges`、係数と実測の一致は `npm test`
   （`scripts/lib/lp-badge-padding.test.mjs`）、見た目の高さと間隔の一致は `npm run test:browser` が検査する。
