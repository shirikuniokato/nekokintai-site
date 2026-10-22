// /nekos/rules/ みんなのねこちゃんのきまり。見出しのねこを描き、アプリから開いた印をリンクに引きつぐだけ。
import { catSvg } from './cat.mjs'
import { appContext, rewriteInternalLinks } from './common.mjs'

rewriteInternalLinks(appContext())
document.getElementById('rl-cat').append(catSvg({
  breed: 'short',
  colors: { body: '#FFFFFF', line: '#000000', eyes: '#000000', collar: '#26CAD4', paws: '#FFAEAE' },
  pose: 'happy',
  dot: 5,
}))
