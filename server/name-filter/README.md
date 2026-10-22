# 投稿名の採用語

`rules.mjs` は LDNOOBW `5faf2ba42d7b1c0977169ec3611df25a3c08eb13` の元データから、露骨な性的表現、強い侮辱、差別語を選別したもの。
出典・CC BY 4.0 と著作者表示は `vendor/ldnoobw/NOTICE.md` と `LICENSE` に保持する。

採用語は意味を確認できるものに絞り、元リスト全体は採用しない。zh-TW は簡繁両表記と台湾の強い罵倒表記を補完した（独自に追加した派生表記）。
英語は単語境界、それ以外は明確な複合語を中心に部分一致を使う。一般語にもなる英語の短語、身体・属性・地名・曖昧な省略語を無差別に拒否しない。
これは初期ルールであり、全不適切名の検出や母語話者による監査を保証しない。通報・運営措置と組み合わせ、誤検出・回避が見つかれば合成例でテストを追加する。

`glyph-codepoints.json` は #260 の `build-glyph-pack --hant=big5` の文字一覧。
DotGothic16、fusion-pixel ko/zh_hant の OGP と同じ pack から取り出した。絵文字や未収録字は2つの名前の両方で拒否する。
生成時の pack SHA-256 を JSON に残し、OGP と正本を照合できるようにする。

更新: `node scripts/vendor-public-inputs.mjs <アプリ repo> <glyphs.bin>`。
code は #245 の正本を bundle したもので、生成物を直接編集しない。
