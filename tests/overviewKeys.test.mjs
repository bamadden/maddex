// The Overview is keyboard-driven (WS2): 1–9 focus a panel, O opens the
// focused panel's module, V switches dense mode; never while typing or with a
// modifier held.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { overviewKey } from '../src/modules/dashboard/overviewOrder.js'

const panel = (name, clicked) => {
  const btn = { click: () => clicked.push(name) }
  const p = { name, focused: false, focus() { p.focused = true }, scrollIntoView() {}, querySelector: (sel) => (sel === '[data-ov-action]' ? btn : null), closest: (sel) => (sel === '[data-ov-panel]' ? p : null), tagName: 'SECTION' }
  return p
}

test('digits focus panels in order; O opens the focused one; V toggles dense', () => {
  const clicked = []
  const panels = [panel('market', clicked), panel('rba', clicked), panel('holdings', clicked)]
  assert.equal(overviewKey({ key: '2' }, { panels, active: null, toggleDense() {} }), true)
  assert.equal(panels[1].focused, true)
  assert.equal(overviewKey({ key: '9' }, { panels, active: null, toggleDense() {} }), false, 'no ninth panel')
  assert.equal(overviewKey({ key: 'o' }, { panels, active: panels[1], toggleDense() {} }), true)
  assert.deepEqual(clicked, ['rba'])
  let dense = 0
  assert.equal(overviewKey({ key: 'v' }, { panels, active: null, toggleDense: () => { dense++ } }), true)
  assert.equal(dense, 1)
})

test('never while typing, and never with a modifier held', () => {
  const panels = [panel('market', [])]
  assert.equal(overviewKey({ key: '1' }, { panels, active: { tagName: 'INPUT' }, toggleDense() {} }), false)
  assert.equal(overviewKey({ key: '1', metaKey: true, shiftKey: true }, { panels, active: null, toggleDense() {} }), false, '⌘⇧1 is a workspace switch')
  assert.equal(panels[0].focused, false)
})

test('every Overview panel is focusable and names its action; dense mode is kept per device', () => {
  const s = fs.readFileSync('src/modules/dashboard/OverviewSurface.jsx', 'utf8')
  assert.match(s, /<section aria-labelledby=\{id\} tabIndex=\{-1\} data-ov-panel/)
  assert.match(s, /data-ov-action/)
  assert.match(s, /maddex_overview_dense/)
  assert.match(s, /data-ov-keys/)
  assert.match(fs.readFileSync('src/index.css', 'utf8'), /\.overview-dense \.overview-grid/)
})
