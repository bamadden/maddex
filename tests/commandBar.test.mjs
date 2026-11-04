// Command bar and global search (Phase 5, docs/audit/command-bar.md).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { FKEY_MODULE } from '../src/components/layout/commandSearch.js'

const read = (f) => fs.readFileSync(f, 'utf8')

test('F1–F8 match the keys the nav shows, stop the browser default and wait while typing', () => {
  const bar = read('src/components/layout/CommandBar.jsx')
  const map = FKEY_MODULE
  const nav = Object.fromEntries([...read('src/components/layout/NavBar.jsx').matchAll(/id: '(\w+)',[^\n]*fkey: '(F\d)'/g)].map((m) => [m[2], m[1]]))
  assert.deepEqual(map, nav)
  assert.equal(Object.keys(map).length, 8)
  const fx = bar.slice(bar.indexOf('// ── Module function keys'), bar.indexOf('// ── Autocomplete'))
  assert.match(fx, /e\.preventDefault\(\)\s*\n\s*setActiveModule\(module\)/)
  assert.match(fx, /if \(typing\) return/)
  assert.match(fx, /e\.metaKey \|\| e\.ctrlKey \|\| e\.altKey \|\| e\.shiftKey/)
  assert.doesNotMatch(fx, /'Escape'/, 'Escape belongs to App.jsx; the bar no longer grabs focus on it')
})

test('Ctrl/⌘+F is left to the browser; Ctrl/⌘+K is handled once', () => {
  const app = read('src/App.jsx')
  assert.doesNotMatch(app, /e\.key\.toLowerCase\(\) === 'f'\)\)/)
  assert.equal(app.match(/\(e\.metaKey \|\| e\.ctrlKey\)[^\n]*e\.key\.toLowerCase\(\) === 'k'/g).length, 1)
})

test('a first-visit tip does not take focus from someone typing', () => {
  const tip = read('src/components/onboarding/ContextualTip.jsx')
  assert.match(tip, /if \(el && \(el\.tagName === 'INPUT' \|\| el\.tagName === 'TEXTAREA' \|\| el\.isContentEditable\)\) return\n\s*cardRef\.current\?\.querySelector\('button'\)\?\.focus/)
})
