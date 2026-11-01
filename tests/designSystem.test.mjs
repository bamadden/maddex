// Design system guards: one type scale with an 11px floor, colour tokens
// that pass WCAG AA, one date format, one logo, a skip link, keyboard-
// reachable rows. Source checks plus pure-function tests; the browser checks
// are in tests/ui.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PAL } from '../src/styles/palette.js'
import { formatDate } from '../src/utils/dateUtils.js'

const SRC = fs.readdirSync('src', { recursive: true }).filter((f) => /\.(jsx?|css)$/.test(f)).map((f) => `src/${f}`)
// Held until after the 3 Nov RBA decision (decision-day card, Rates banner).
const HELD = new Set(['src/modules/fx/RbaHeroCard.jsx', 'src/modules/fx/RbaDecisionCard.jsx', 'src/modules/fx/RbaDecisionPreview.jsx', 'src/modules/fx/RbaHikeImpact.jsx'])
const SCALE = new Set([11, 12, 13, 14, 16, 20, 28, 36, 48])

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

test('every font size in the code is on the scale, none under 11px', () => {
  const off = []
  for (const f of SRC) {
    if (HELD.has(f)) continue
    const s = fs.readFileSync(f, 'utf8')
    for (const m of s.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)(?=\s*[,}\n)])|text-\[(\d+(?:\.\d+)?)px\]|font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      const v = Number(m[1] ?? m[2] ?? m[3])
      if (!SCALE.has(v)) off.push(`${f}: ${m[0]}`)
    }
  }
  assert.deepEqual(off, [])
  assert.match(fs.readFileSync('tailwind.config.js', 'utf8'), /'2xs': \['0\.6875rem'/) // 11px
})

test('change and label colours pass WCAG AA (4.5:1) on every panel background', () => {
  for (const bg of ['#060D1A', '#0B1628', '#0F1E35', '#13233D']) {
    for (const k of ['up', 'down', 'muted', 'dim', 'gold', 'bright']) assert.ok(contrast(PAL[k], bg) >= 4.5, `${k} ${PAL[k]} on ${bg}: ${contrast(PAL[k], bg).toFixed(2)}`)
  }
  const css = fs.readFileSync('src/index.css', 'utf8')
  assert.match(css, /--t-red:\s+235 107 102/)
  assert.match(css, /--t-green:\s+63 176 107/)
})

test('the failing colours are gone from the code', () => {
  for (const f of SRC) {
    if (HELD.has(f) || f.endsWith('styles/palette.js')) continue
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /#(A83232|4A6080|637899|2D8A50)\b/i, f)
  }
})

test('one date format: "29 Sep 2026", never "Sept"', () => {
  assert.equal(formatDate('2026-09-29'), '29 Sep 2026')
  assert.equal(formatDate('2026-11-03', { weekday: true }), 'Tue 3 Nov 2026')
  assert.equal(formatDate('2026-11-03', { year: false }), '3 Nov')
  assert.equal(formatDate(Date.parse('2026-10-31T14:30:00Z')), '1 Nov 2026') // Sydney date
  assert.equal(formatDate(null), '—')
})

test('one logo: the shared lockup, no text mark, no second mark in the sidebar', () => {
  for (const f of ['src/components/layout/TopBar.jsx', 'src/components/auth/AuthModal.jsx']) assert.match(fs.readFileSync(f, 'utf8'), /<BrandLockup/, f)
  for (const f of SRC) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /▲ MADDEX/, f)
  assert.doesNotMatch(fs.readFileSync('src/components/layout/NavBar.jsx', 'utf8'), /icon-mark-96/)
})

test('a skip link to the module area, and clickable rows made keyboard-reachable', () => {
  const app = fs.readFileSync('src/App.jsx', 'utf8')
  assert.match(app, /className="skip-link"/)
  assert.match(app, /<main id="main-content" tabIndex=\{-1\}/)
  assert.match(app, /startKeyboardClickables\(\)/)
  assert.match(fs.readFileSync('src/index.css', 'utf8'), /@media \(pointer: coarse\)[\s\S]*width: max\(100%, 44px\); height: max\(100%, 44px\)/)
})

test('loading states use the shared component', () => {
  for (const f of SRC) {
    if (HELD.has(f) || f.endsWith('ModuleStates.jsx')) continue
    assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /<(span|div)[^>]*>LOADING[A-Z ]*\.\.\.<\/(span|div)>/, f)
  }
})
