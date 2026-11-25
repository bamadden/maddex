// npm run check:first-paint — after `npm run build`. Fails when the gzip
// total of every JS and CSS file dist/index.html loads (entry script,
// modulepreloads, stylesheet) is over the budget (WS6, 20 Nov 2026: 240 KB).
import fs from 'node:fs'
import zlib from 'node:zlib'

export const FIRST_PAINT_BUDGET_KB = 240

export function firstPaintKb(dist = 'dist') {
  const html = fs.readFileSync(`${dist}/index.html`, 'utf8')
  const files = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])
  const bytes = files.reduce((n, f) => n + zlib.gzipSync(fs.readFileSync(dist + f), { level: 9 }).length, 0)
  return { kb: bytes / 1024, files: files.length }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { kb, files } = firstPaintKb()
  const ok = kb <= FIRST_PAINT_BUDGET_KB
  console.log(`${ok ? '✓' : '✗'} first paint ${kb.toFixed(1)} KB gzip across ${files} files (budget ${FIRST_PAINT_BUDGET_KB} KB)`)
  if (!ok) process.exit(1)
}
