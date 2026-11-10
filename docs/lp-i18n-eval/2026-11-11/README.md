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
