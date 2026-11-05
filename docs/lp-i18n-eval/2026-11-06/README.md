# 簡体字中国語（zh-Hans）の追加 2026-11-06

アプリ 2.5.2 が簡体字（`zh-Hans`）に対応したのに合わせ、サイトの全 6 ページ（LP 40・tip 25・qa 160・roadmap 124・contact 35・privacy 46 ＝ 430 キー）を
中国本土向けの簡体字へ訳し、5 つ目の言語として `/zh-Hans/` に出した。URL・hreflang・locale キーはすべて `zh-Hans`。
手順は `launch/lp-i18n-workflow-2026-09-01.md` と同じで、スクリプトは今回足した `--locales zh-Hans` で簡体字だけを対象にし、
公開ずみの en / ko / zh-TW の辞書は 1 行も変えていない（`git diff` で追加行のみ）。

## 顔ぶれ

| 段 | モデル | ファイル |
|---|---|---|
| 初稿 | Gemini `gemini-3.1-pro-preview`（`npm run translate:lp-i18n -- --page <page> --locales zh-Hans`。参考として公開ずみの zh-TW を添えた） | `<page>-gemini.json`（LP は `lp-draft.json` に直接） |
| 用語の一括置換 | 手作業（アプリ 2.5.2 の `src/app/i18n/locales/zh-Hans.json` の実ラベルへ） | `terms-zh-hans.json` → `<page>-draft.json` |
| 監査 | Claude Fable `claude-fable-5`（`claude --print`）と GPT `gpt-5.6-sol`（`codex exec`）が独立に | `<page>-audit-fable.json` / `<page>-audit-codex.json` |
| 採用 | `<page>-adopted.json` → `npm run apply:lp-i18n:draft -- --page <page> --locales zh-Hans` | |
| 逆翻訳 | GPT `gpt-5.6-sol`（`npm run audit:lp-i18n:reverse -- --page <page> --locales zh-Hans`） | `<page>-reverse-audit.json` |

Fable の CLI はこのセッションの中から通った（2026-10-22 のアプリ側の記録では落ちていたが、今回は 6 ページとも exit 0）。Gemini の残高も足りた。
決まった顔ぶれで回せなかった段は無い。

## 初稿で直した用語（`terms-zh-hans.json`）

Gemini はプロンプトの「画面名・ボタン名は同じ訳語をくり返す」を「訳さない」と読み、「ねこ屋さん」を日本語のまま残した（LP・tip・roadmap）。
ほかにも繁体字版の語（支持方案・工作分类・调休・设为休息・锁屏・社长・猫咪商店）が混じったので、アプリの実ラベルへ一括で置き換えた:
猫咪小铺・支持计划・工作类别・补班・设为休假・休假日・锁定屏幕・老板・备份在这里・添加工作项目・现在正在做的事・和这只猫咪一起走・燕尾服（ハチワレ）・轻松（ゆったり）・猫咪与这一周。
屋号「ｼﾁｬのねこ屋さん」は訳さないので、置換後に元へ戻している。

## 監査で採用したもの

各ページの `<page>-adopted.json` が正本。要点:

- **LP**（Fable 6・Codex 9）: 「ねこ屋さん」の未訳（両者 high）→ アプリの `猫咪小铺` で手直し。台湾寄りの語法「有在工作」「数算」（Fable high）、「写信」→「发邮件」、「免账号」→「无需账号」、
  投げ銭は `打赏`（tip と統一）。Codex の `makerCopyBeforeLink` はリンク前の半角スペースが落ちていたので Fable 案を採った
- **tip**（Fable 3・Codex 7）: `（¥100〜¥10,000）` → `（100～10,000 日元）`（両者 high。中国本土では ¥ が人民元に読まれる）、「相对地」→「作为回报」、「线上商店」→「网店」
- **contact**（Fable 1・Codex 10）: 説明文と lead の「想要新功能」が原文より狭い（Codex high）→ 手直し（作者ひとりの声なので Codex 案の「我们」は「我」に）。
  「请稍等一下」→「请耐心等待」（数日かかる案内と噛み合わないため）
- **privacy**（Fable 12・Codex 9）: 「包月方案」→「包月订阅」（Fable high）、Google の公式名称「停用浏览器插件」、「邮箱地址」への統一、全角コロンへの統一、
  「送信先」のラベルは「接收方」に手直し
- **roadmap**（Fable 14・Codex 33）: 「我将…整理」が未来の行為に読める（Codex high）、「振替の週 2 日」が「2 次」になっていた（Codex high）、「手机」→「设备」（Codex high）、
  iOS 26 の「色合い」は本土の公式表記「着色」（Fable）。画面を指す「画面」は「页面」、「月画面／周画面」は「月页面／周页面」に置換
- **qa**（Fable 34・Codex 39）: 「翌日の時刻」が「时长」（両者 high）、「かけ算が合わない」が意味不明（両者 high）、「悩んでいます」の「烦恼」→「犹豫」、
  横画面は「横屏／竖屏」、「评估看看」「都有看」などの台湾寄りの語法、「您／你」の揺れ、不具合は「问题」に統一。
  質問（`*Question`）は見出しなので、ja / zh-TW と同じく末尾の「。」を落とした（`manual` 21 件）。
  「これからのこと」の見出しは「接下来的计划」だと実装予定に読めるので、zh-TW と同じく「接下来的事」に手直し（2026-09-04 の他言語と同じ判断）

## 採らなかったもの

- **ホーム → 主页**（roadmap: Fable・Codex ともに「主页」へ統一を提案）: アプリのタブは `首页` なので、逆に `主页` を `首页` に置換した。OS のホーム画面は `主屏幕` のまま
- **ハチワレ → 八字脸**（qa: Fable medium・Codex high）: アプリの「じぶんだけのねこ」の柄名が `燕尾服` なので、画面で探せる表記を優先
- **1日のきりかえ時刻 → 日期切换时间**（qa: Codex）: アプリの設定名が `一天的切换时间`
- **contact の「建议与反馈 → 意见与建议」**（Codex）: 見出しは LP の `contactLink` と同じ訳を使う共通キーで、サイト全体のリンク名と揃える
- **tip `amount1000Label` 「猫咪的饭 → 猫粮」**（Codex）: 世界観の文言なので、かわいさを残す
- **tip `note4`**（逆翻訳 medium・Fable 比例案）: 「いただいた分だけ」の比例の含みは 2026-09-04 の他言語と同じく、取引に聞こえない表現を優先して採らない
- **roadmap の「現在…了」**（逆翻訳 medium 5 件: 公開ずみの版が「できるようになりました」と読める）: zh-TW と同じ書きかたで、該当の版はすべて公開ずみなので変えない
- **tip の注の先頭の「・」**: 他言語は日本語の中黒をそのまま行頭の印に使っているが、簡体字は「中黒を持ち込まない」の方針どおり外した
- **roadmap の文末の「。」の揺れ**（ios210 以降だけ付く）: zh-TW と同じ揺れなので今回は触らない

## 逆翻訳の監査

lp 0・tip 1（上記 note4）・contact 0・privacy 0・roadmap 6（上記の時制 5 件と、お問い合わせページの呼称 1 件は contact のリンク名と同じなので変えない）・qa 1（ハチワレ＝燕尾服。上記のとおりアプリの柄名）。critical / high なし。

## 機械検査と実画面

`npm run check:i18n` に簡体字用の検査を足した: 台湾寄りの語（喔・啰・依照・作業・程式・資料・帳號・小舖）、日本語の中黒「・」、`¥`・`円`、よく出る繁体字の混入、`时间存钱罐` の固定。
`npm test` 89 件・`npm run test:browser` 26 件・`npm run build` が通る。
一時プレビュー（`nr app deploy nekokintai-zh-hans-preview <worktree>/.pages-dist/site --static`。確認後に `nr app rm`）で /zh-Hans/ の 6 ページと / と /zh-TW/ を
Playwright で 390px / 1280px の全画面で撮り、はみ出し・欠け・404 が無いことを見た。サーバーの簡体字フォントは WenQuanYi Zen Hei（DotGothic16 に無い字の代替）。

## 素材と判断

- ストアバッジは公式素材: App Store は Apple Marketing Tools の `download-on-the-app-store/black/zh-cn`（SVG, CNSC）、
  Google Play は `play.google.com/intl/en_us/badges/static/images/badges/zh-cn_badge_web_generic.png`（646×250、透明余白は上下 29px・左右 0 で zh-TW と同じ）
- App Store のリンク先は `cn` ストア（iTunes Lookup で `country=cn` に配信を確認）
- LP の 4 枚のアプリ画面は、簡体字のアプリから撮った素材がまだ無いので zh-TW の画像を出している（`assets/lp/i18n.mjs` の `SCREENSHOT_FALLBACK_LOCALES`）。
  撮り直しは `docs/lp-screenshots/README.md` の手順（2.5.2 のビルド・デモデータ・hariko 合成）で別作業
