# LP 翻訳監査 2026-09-02

ショップ画面の見出しを「たくさんの、\nねこがいるよ。」へ更新した際のローカライゼーション記録です。

1. Gemini 3.1 Pro が、日本語40文言を含む3言語の初稿を生成した（`gemini-initial.json`）。
2. Claude Fable 5 と GPT-5.6 Sol が独立監査した（`audit-claude-fable.json`、`audit-gpt.json`）。
3. 今回の変更キー `shopScreenTitle` のみを採用した。英語・繁体字は両監査で指摘なし、韓国語は Fable の改行位置を採用した。既存の39キーは再翻訳で上書きしない。
4. 最終稿を日本語への逆翻訳で照合する（`reverse-japanese-final.json`）。
