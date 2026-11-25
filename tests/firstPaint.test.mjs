// First paint (WS6): the budget script, and what keeps the entry chunk small —
// the command bar, bell and rarely-shown overlays load just after first paint.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { firstPaintKb, FIRST_PAINT_BUDGET_KB } from '../scripts/check-first-paint.mjs'

const read = (f) => fs.readFileSync(f, 'utf8')

test('the budget is 240 KB and the script counts only what index.html loads', () => {
  assert.equal(FIRST_PAINT_BUDGET_KB, 240)
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-'))
  fs.mkdirSync(path.join(dist, 'assets'))
  const a = 'x'.repeat(5000), b = 'body{}'
  fs.writeFileSync(path.join(dist, 'assets/index-1.js'), a)
  fs.writeFileSync(path.join(dist, 'assets/index-1.css'), b)
  fs.writeFileSync(path.join(dist, 'assets/lazy-2.js'), 'y'.repeat(90000))   // not referenced
  fs.writeFileSync(path.join(dist, 'index.html'), '<script type="module" src="/assets/index-1.js"></script><link rel="stylesheet" href="/assets/index-1.css">')
  const { kb, files } = firstPaintKb(dist)
  assert.equal(files, 2)
  const want = (zlib.gzipSync(a, { level: 9 }).length + zlib.gzipSync(b, { level: 9 }).length) / 1024
  assert.equal(kb, want)
})

test('App lazy-loads the command bar behind a same-size shell that hands over typed text and focus', () => {
  const app = read('src/App.jsx')
  assert.match(app, /const CommandBar = lazy\(\(\) => import\('\.\/components\/layout\/CommandBar'\)\)/)
  assert.doesNotMatch(app, /^import CommandBar /m)
  assert.match(app, /<Suspense fallback={<CommandBarShell \/>}><CommandBar early={earlyCommand} \/><\/Suspense>/)
  const shell = read('src/components/layout/CommandBarShell.jsx')
  assert.match(shell, /earlyCommand\.value = e\.target\.value/)
  assert.match(shell, /earlyCommand\.focused = true/)
  assert.match(shell, /aria-label="Command bar: ticker, command or question"/)
  const bar = read('src/components/layout/CommandBar.jsx')
  assert.match(bar, /useState\(\(\) => early\?\.value \?\? ''\)/)
  assert.match(bar, /if \(early\?\.focused\) inputRef\.current\?\.focus\(\)/)
})

test('overlays and the bell are not in the entry chunk', () => {
  const app = read('src/App.jsx')
  for (const name of ['NotificationPermissionPrompt', 'AlertSuggestion', 'ContextualTip', 'TrialNudges']) {
    assert.match(app, new RegExp(`const ${name} = lazy\\(`), name)
    assert.doesNotMatch(app, new RegExp(`^import ${name} `, 'm'), name)
  }
  const top = read('src/components/layout/TopBar.jsx')
  assert.match(top, /const NotificationCenter = lazy\(/)
  assert.match(top, /fallback={<BellPlaceholder \/>}/)
})
