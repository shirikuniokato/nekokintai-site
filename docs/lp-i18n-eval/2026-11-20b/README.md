# よくあるしつもん: 2.6.1 の画面に合わせた直し 2026-11-20

2.6.1（設定の作り直し #360・週／月／記録の作り直し #361・じぶんだけのねこの入口 #272・けした作業 #145 #171）の公開後に、
`/qa/` の操作の道すじと呼び名を 2.6.1 のアプリの実ラベルに合わせた。直したのは 15 キー（`qa-draft.json` の `newKeys`）。

## 日本語の正本（本人 OK 済み）

| キー | 直したこと |
|---|---|
| howTo24Answer | 入口「ねこ屋さんの右上の家のマーク」→「設定のいちばん上の『じぶんだけのねこ』か、ねこ屋さんのいちばん上の札」 |
| howTo22Answer | 「目標と設定 → 1日の目標の下」→「アプリ → 見た目とことば」の「時間の見せかた」 |
| howTo18Answer | 「記録の右上のボタン」→「記録のいちばん上の『これまでのきろく』」（押すと作業ごとの内わけ） |
| howTo11Answer / supporter3Note | 「バックアップはこちら」→「アプリ」の「バックアップ」（ファイルに書き出す／バックアップからもどす） |
| howTo5Answer / howTo5Note / howTo13Note | 「1日のきりかえ時刻」→「週と1日のくぎり」の「1日の切り替え時刻」 |
| howTo15Answer / howTo15Note | けした作業は「作業のカテゴリ」の中。時間を記録していない作業は完全にけせる（2.6.1）・合計にのこすか選べる |
| upcoming13Answer | 「このねこと歩く」（どの画面からも使われていない）→「相棒にする」 |
| unlikely12Answer | 简体中文を足し、「見た目とことば」でえらべることを書く |
| upcoming3Answer | 無料 15 匹・ぜんぶで 17 匹 → 2.6.0 の 3 匹で 18 匹・20 匹 |
| upcoming10Note | 画面に文字の無い「色をかえる」→「作業の名前のよこの色の四角」 |
| howTo1Answer | 「おわるで確定」→ アプリの説明どおり「直すとそのつど保存・おわるで とじる」 |

ロードマップの 2.5.0 のカードの「（ねこ屋さんの右上の家のマークから）」は、当時の記録として残す（本人決定）。

## 訳の出どころ（標準の手順から外れた点あり）

- 4 言語とも、直した 15 キーは **Claude Opus 5.5（`claude-opus-5-5`、この作業のセッション）が書いた**。Gemini は 11/11 から前払い残高切れのままで、今回は試していない
- 呼び名はアプリの実ラベル（`release-2.6.1` の `src/app/i18n/locales/*.json`）: `settingsLayout.*`・`advancedSettings.title`・`goals.*`・`categories.*`・`customCat.*`・`generated` の LifetimePanel／ShopScreen／BackupSection
- ほかのキーは公開中の辞書の値のまま（`qa-draft.json` は mixed）
- 初稿（Opus）と Fable の監査はどちらも Anthropic 系。Codex（gpt-5.6-sol）の監査と逆翻訳が別系統

## 監査

ページ全体（160 キー × 4 言語）を監査し、直した 15 キーへの指摘だけを見た。

- Fable `claude-fable-5`（`qa-audit-fable.json`）: 31 件。直したキーへの指摘は 5 件
- Codex `gpt-5.6-sol`（`qa-audit-codex.json`）: 9 件。直したキーへの指摘は 4 件
- 逆翻訳 `gpt-5.6-sol`（`qa-reverse-audit.json`）: 0 件

**採用は 1 件**（`qa-adopted.json`）:

- zh-Hans `howTo24Answer`: ハチワレを「燕尾服」→「八字脸」（Codex）。アプリの `customCat.hachi` が「八字脸」で、「燕尾服」は `customCat.tuxedo`。改行位置は Fable の案（zh-TW と同じ位置）

採らなかったもの:

- zh-Hans `howTo5Answer` / `howTo5Note` / `howTo13Note`（Codex high）「每周与每天的起始设置 → 分界」: アプリの実ラベル（`settingsLayout.calendarTitle`）が「每周与每天的起始设置」。サイトだけ変えると画面で探せなくなる。アプリ側の訳を直すなら別の作業
- zh-TW / zh-Hans `howTo15Note`（Fable）「合計 → 總計」: 後半はアプリの選択肢 `categories.keepTime`（將記錄的時間保留在合計中）の言い方
- zh-TW `howTo18Answer`（Fable）「合計 → 總計」: 公開中の訳から変えていない語
- zh-Hans `upcoming3Answer`（Fable）括弧書きが長い: 今回変えていない行（公開中のまま）

直したキー以外への指摘は今回の範囲外で、公開中の訳は変えていない。

## 確認

`npm run check:i18n`・`npm test`（100 件）・`npm run build`・`npm run test:browser`（26 件）を通した。
build 後の `.pages-dist/site/qa/` を Playwright（390px 幅）で開き、ja / en / zh-Hans の howTo24Answer・howTo11Answer を撮って折り返しを確かめた。
