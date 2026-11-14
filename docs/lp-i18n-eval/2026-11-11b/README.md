# ロードマップ 2.6.0 のカード（たいおうちゅう）2026-11-11

2.6.0 の審査提出に合わせ、`/roadmap/` の iOS / Android の両方の列に、2.5.2 のカードの上へ「たいおうちゅう」のカードを足した（`statusInProgress` / `whenInProgress`）。
公開後の「こうかいずみ」への切り替えは cron の `sync-store-update` に任せる。

## 日本語の正本

ストアのリリースノート（`nekokintai/docs/store/releases/2.6.0/copy.ja.json` の `releaseNotes` / `whatsNew`。本人 OK 済み、両 OS 同じ文）を 1 項目ずつキーにした。iOS と Android で同じ文なので、5 キーとも両方の列で共有する:

- `v260Item1` ねこ屋さんに、しゃむねこ・らぐどーるねこ・ふわはちわれねこが来ました（無料）
- `v260Item2` じぶんだけのねこに、新しい柄と、左右でちがう目の色を足しました
- `v260Item3` 退勤のおし忘れの通知を押すと、そのまま時間を直せるようにしました
- `v260Item4` 11/19〜12/20 のあいだ、ねこ屋さんで期間限定のおたのしみがあります
- `v260Item5` こまかな不具合を直しました

改行は 2.5.x のカードにそろえ、1〜4 は 2 行（1 行 15〜21 字）、5 は 1 行。

## 訳の出どころと顔ぶれ（標準の手順から外れた点あり）

- en / ko / zh-TW: ストアの確定訳（同ディレクトリの `i18n-eval/`。監査・逆翻訳済み）に、ja と同じ行数の改行を入れたもの。語は変えていない
- zh-Hans: **初稿は Claude Opus 5.5（`claude-opus-5-5`、この作業のセッション）が書いた。** `npm run translate:lp-i18n -- --page roadmap --locales zh-Hans` が
  `Gemini HTTP 402`（前払い残高切れ）で落ちたため。`roadmap-gemini-zh-hans.json` は無い。`roadmap-draft.json` の `zhHansNewKeysBy` に記録
  - 用語はアプリの実ラベル（`release-2.6.0` の `src/app/i18n/locales/zh-Hans.json`）: 猫咪小铺・暹罗猫・布偶猫・蓬蓬八字脸猫（`skins.*.name`）・专属猫咪・花纹・修改时间・「下班」
  - zh-TW のストア訳と同じ組み立てにした（例: 提醒你还没按“下班”的通知 ← 提醒你還沒按「下班」的通知）
- draft: 2.5.2 と同じく mixed（既存キーは今の辞書の値、新 5 キーは上記）。`apply:lp-i18n:draft` は `--locales zh-Hans` に絞り、適用後の差分が新 5 キーだけであることを確かめた
- **初稿（Opus）と Fable の監査はどちらも Anthropic 系**。Codex（gpt-5.6-sol）の監査と逆翻訳が別系統

## 監査

5 キー × 4 言語を、公開ずみのキーと一緒にページ全体として監査（`--locales en,ko,zh-TW,zh-Hans`）。

- Fable `claude-fable-5`（`roadmap-audit-fable.json`）: 28 件。新キーへの指摘は 2 件
- Codex `gpt-5.6-sol`（`roadmap-audit-codex.json`）: 18 件。新キーへの指摘は 1 件
- 逆翻訳 `gpt-5.6-sol`（`roadmap-reverse-audit.json`）: 4 件（すべて medium、critical / high なし）。新キーへの指摘は 2 件

**採用は 0 件**（`roadmap-adopted.json`）。新キーへの指摘と、採らなかった理由:

- en `v260Item1`（Codex high・逆翻訳 medium）「black-cap → tuxedo」: 採らない。`Fluffy black-cap cat` はアプリの実ラベル（`skins.fuwahati.name`）で、ストアの確定訳とも同じ
- ko `v260Item1`（逆翻訳 medium）「젖소 고양이 は白黒全般」: 採らない。`복슬복슬 젖소 고양이` はアプリの実ラベル
- zh-TW `v260Item3`（Fable medium）「你 → 人称なし」: 採らない。ストアの確定訳（ストア側の監査で Sol の置換として採ったもの）
- zh-Hans `v260Item3`（Fable medium）同上: 採らない。zh-TW と対にしてあり、アプリの通知文（`notifications.forgotClockOut`「昨天没有按下「下班」」）と同じ言い方。Codex・逆翻訳は指摘なし

新キー以外への指摘（Fable 26・Codex 17・逆翻訳 2。zh-Hans `whenInProgress` の「已送审」、ko `statusInProgress` 等を含む）は今回の範囲外で、公開中の訳は変えていない（2.5.2 と同じ扱い）。

## 確認

`npm run check:i18n`・`npm test`（94 件）・`npm run build`・`npm run test:browser`（26 件）を通した。
build 後の `.pages-dist/site` を Playwright（390px 幅）で開き、ja / en / ko / zh-Hans の 2.6.0 のカードを撮って確かめた。en は既存どおり改行なしで流し込み（`white-space:normal`）、`black-cap` がハイフンで折り返る。
