# OGP の文字データ

`glyphs.bin` は #260 の `build-glyph-pack --hant=big5` から生成した輪郭データ。
優先順は DotGothic16 → fusion-pixel ko → fusion-pixel zh_hant。

元フォントと帰属・許諾:

- [DotGothic16](https://github.com/google/fonts/tree/main/ofl/dotgothic16): 同梱 `OFL-DotGothic16.txt`
- [fusion-pixel-font](https://github.com/TakWolf/fusion-pixel-font): 同梱 `OFL-fusion-pixel.txt`

SIL Open Font License 1.1。元の字形を名前用の独自形式へ変換した。
サーバーの `server/name-filter/glyph-codepoints.json` と同じ pack を使い、投稿時に描けない文字を断る。
