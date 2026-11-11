# フリーアイコン（/icons/）の訳の監査 2026-11-11

新しいページ `/icons/`（14 キー）を 4 言語に訳した記録。

- 初稿: Gemini の前払い残高が切れている（402）ため、Fable の直書き（`icons-draft.json`）。手順からの外れはこの 1 点
- 独立監査: Fable 10 件・Codex 1 件（どちらも medium だけ。`icons-audit-fable.json` / `icons-audit-codex.json`）
- 採用（`icons-adopted.json`）: 全部で 10 キー
  - zh-TW の「頭像」→「頭貼」（7 キー。台湾での呼びかた）
  - zh-TW の rule2 は Codex の文（「請勿修改、重新散布或用於商業用途。」）。Fable の指摘と同じ箇所で、「加工」→「修改」も含むほうを採った
  - 「SNS など」の「など」の欠け（en の rule1、zh-TW・zh-Hans の documentDescription）
- 逆翻訳の監査（`icons-reverse-audit.json`）: 0 件
- `npm run check:i18n`: 合格

languageSelector・faqLink・contactLink・privacyLink はトップLPの訳、backToTop は `/tip/` の訳をそのまま使っている。

## 保存のまえの注意（terms* の 7 キー）を足したとき

カードを押すと出る「保存のまえに」の箱の文（7 キー）を足して、ページ全体（21 キー）をもう一度監査した。

- 初稿: 上と同じく Fable の直書き（`icons-terms-draft.json`）
- 独立監査: Fable 4 件・Codex 3 件（どちらも medium だけ。`icons-terms-audit-fable.json` / `icons-terms-audit-codex.json`）
- 採用（`icons-terms-adopted.json`）: 4 キー
  - en の documentDescription に「SNS など」を補う（rule1 と同じ句）
  - zh-TW の termsItem2 の「加工」→「修改」（rule2・termsItem1 とそろえる）
  - zh-TW・zh-Hans の termsLead は Codex の文（「僅供個人欣賞與使用」／「仅供个人欣赏和使用」）
- 見送り: ko の rule1・documentDescription（「개인적인 용도로」で個人利用の限定は伝わっている。前回の監査では指摘なし）
- 逆翻訳の監査（`icons-terms-reverse-audit.json`）: 0 件

## トップのボタン（iconsLink）

トップLPに足した「フリーアイコン」のボタンの文（`iconsLink`）は、このページの `heading` の訳（監査済み）を 5 言語ともそのまま使っている。あわせてトップLPの `supportNote` は 5 言語から外した。
