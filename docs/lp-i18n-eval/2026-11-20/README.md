# ロードマップ 2.6.1 のカード（たいおうちゅう）2026-11-20

2.6.1 の審査提出（2026-11-20、iOS / Android）に合わせ、`/roadmap/` の iOS / Android の両方の列に、2.6.0 のカードの上へ「たいおうちゅう」のカードを足した（`statusInProgress` / `whenInProgress`）。
公開後の「こうかいずみ」への切り替えは cron の `sync-store-update` に任せる。

## 日本語の正本

ストアのリリースノート（`nekokintai/docs/store/releases/2.6.1/copy.ja.json` の `releaseNotes` / `whatsNew`。本人 OK 済み、両 OS 同じ文）を 1 項目ずつキーにした。iOS と Android で同じ文なので、7 キーとも両方の列で共有する。

- `v261Item1` 設定の画面を作り直して、さがしやすくしました
- `v261Item2` 週・月・記録の画面を見やすくしました（色分けを5段階に、「1日あたり」の時間も出ます）
- `v261Item3` 作業をけしても、きろくした時間は合計にのこるようにしました（のこさないことも選べます）。これまでにけした作業の時間も、合計にもどります
- `v261Item4` 日の画面から、前後の日へそのまま移れます
- `v261Item5` 時刻の入力に「いま」と、長押しでぜんぶ消す操作を足しました
- `v261Item6` ねこのひとことを、設定で切れるようにしました
- `v261Item7` こまかな不具合を直しました

夢みるねことの連携（nekokintai #357）は告知しないので、カードにも書いていない。

改行は 1 行 10〜18 字ほど。2 は 3 行、3 は 5 行、7 は 1 行、ほかは 2 行。
はじめは 2 を 2 行・3 を 3 行にしたが、390px 幅で「す）」「す」の 1 文字だけが次の行に落ちたので、監査のあとに改行だけ入れ直した（語は変えていない。`roadmap-draft.json` も入れ直したあとの形）。

## 訳の出どころと顔ぶれ（標準の手順から外れた点あり）

- en / ko / zh-TW: ストアの確定訳（`nekokintai/docs/store/releases/2.6.1/i18n-eval/`。監査・逆翻訳済み）に、ja と同じ行数の改行を入れたもの。語は変えていない（空白と改行を除いて同じ文であることを機械的に照合した）
- zh-Hans: **初稿は Claude Opus 5.5（`claude-opus-5-5`）が書いた。** Gemini が `HTTP 402`（前払い残高切れ）で使えないため（同じ日にストア文言の `draft` で確かめた）。
  この作業のセッションの primary は Claude Fable で、Fable は監査を受け持つので、primary が別モデル（Opus）の subagent を起こして書かせた。`roadmap-draft.json` の `zhHansNewKeysBy` に記録
  - 用語はアプリの実ラベル（`release-2.6.1` の `src/app/i18n/locales/zh-Hans.json`）: 设置・周・月・记录（`app.tabs`）、平均每天（`screens.lifetimeAverage`）、现在（`components.timePad.now`）、猫咪的一句话（`catSpeech`）、工作・删除・保留在合计中（`screens.categories`）
  - 「画面」はこのページの既存の訳（“月”页面）に合わせて「页面」。日の画面は zh-TW に合わせて「单日页面」
- draft: 2.6.0 と同じく mixed（既存キーは今の辞書の値、新 7 キーは上記）。`apply:lp-i18n:draft` 適用後の辞書の差分が新 7 キーだけであることを確かめた
- **初稿（Opus）と Fable の監査はどちらも Anthropic 系**。Codex（gpt-5.6-sol）の監査と逆翻訳が別系統

## 監査

7 キー × 4 言語を、公開ずみのキーと一緒にページ全体として監査（`--locales en,ko,zh-TW,zh-Hans`）。

- Fable `claude-fable-5`（`roadmap-audit-fable.json`）: 35 件。新キーへの指摘は 0 件
- Codex `gpt-5.6-sol`（`roadmap-audit-codex.json`）: 30 件。新キーへの指摘は 0 件
- 逆翻訳 `gpt-5.6-sol`（`roadmap-reverse-audit.json`）: 3 件（すべて medium、critical / high なし）。新キーへの指摘は 0 件

**採用は 0 件**（`roadmap-adopted.json`）。新キー以外への指摘（公開中の訳。zh-TW の「主畫面」、zh-Hans の「建议与反馈页面」「已送审」など）は今回の範囲外で、変えていない（2.5.2・2.6.0 と同じ扱い）。

## 確認

`npm run check:i18n`・`npm test`（100 件）・`npm run build`・`npm run test:browser`（26 件）を通した。
build 後の `.pages-dist/site` を Playwright（390px 幅）で開き、5 言語の 2.6.1 のカードを撮って確かめた（改行を入れ直したあとにもう一度）。en は既存どおり改行なしで流し込み。
