// 日本語を文節の切れ目でだけ折り返す。「ご連絡くだ／さい」「お問い／合わせ」のような不自然な改行を出さないため。
// CSS の word-break: auto-phrase は iPhone の Safari が対応しておらず、「」の中（ボタンの名前）も折ってしまうので、
// どのブラウザでも BudouX で文節の切れ目にゼロ幅スペースを入れ、keep-all でそこだけで折る。

const ZERO_WIDTH_SPACE = '​'
const JAPANESE = /[぀-ヿ㐀-鿿]/
// 共有文などの文言の元（#nk-copy）にゼロ幅スペースを混ぜると、コピーやシェアの文に入ってしまう
const SKIP = 'script, style, title, textarea, input, #nk-copy'

// 「アプリに反映する」のような画面の名前は、途中で折らない
const QUOTED = /「[^「」]*」/g

async function start() {
  const [{ Parser }, { model }] = await Promise.all([
    import('./vendor/budoux/parser.js'),
    import('./vendor/budoux/ja.js'),
  ])
  const parser = new Parser(model)
  document.documentElement.classList.add('nk-phrase-wrap')

  const wrapText = (node) => {
    const text = node.data
    if (!JAPANESE.test(text) || text.includes(ZERO_WIDTH_SPACE)) return
    if (node.parentElement?.closest(SKIP)) return
    const joined = parser.parse(text).join(ZERO_WIDTH_SPACE)
      .replace(QUOTED, (quoted) => quoted.replaceAll(ZERO_WIDTH_SPACE, ''))
    if (joined !== text) node.data = joined
  }
  const wrapTree = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) wrapText(node)
  }

  wrapTree(document.body)
  // 文言はあとから JS や言語の切りかえで書きかわるので、そのたびに入れなおす
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') wrapText(record.target)
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) wrapText(node)
        else if (node.nodeType === Node.ELEMENT_NODE) wrapTree(node)
      }
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true })
}

start().catch((error) => console.error('phrase-wrap', error))
