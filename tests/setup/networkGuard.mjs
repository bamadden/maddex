// Loaded before every test file (`node --test --import ./tests/setup/networkGuard.mjs`).
//
// Tests must never reach the Anthropic API or the MaddenAI proxy: a run would
// spend real money and depend on a live service. Every fetch and every
// http(s) request is checked here; one to api.anthropic.com or to an
// /api/claude path is refused with an error, and recorded. If any was made
// outside guard.expectBlocked(), the test process exits non-zero even when
// the code under test swallowed the error.

import http from 'node:http'
import https from 'node:https'

const BLOCKED_HOSTS = [/(^|\.)anthropic\.com$/i]
const BLOCKED_PATHS = [/^\/api\/claude\b/, /^\/api\/ai-daily\b/]

const attempts = []
let expecting = 0

function check(urlLike) {
  let u
  try { u = new URL(String(urlLike), 'http://localhost') } catch { return }
  if (BLOCKED_HOSTS.some((re) => re.test(u.hostname)) || BLOCKED_PATHS.some((re) => re.test(u.pathname))) {
    attempts.push({ url: u.href, expected: expecting > 0 })
    throw new Error(`NETWORK GUARD: tests may not call ${u.href} — mock it`)
  }
}

const realFetch = globalThis.fetch
if (realFetch) {
  globalThis.fetch = async (input, init) => {
    check(typeof input === 'string' || input instanceof URL ? input : input?.url)
    return realFetch(input, init)
  }
}
for (const mod of [http, https]) {
  for (const fn of ['request', 'get']) {
    const real = mod[fn]
    mod[fn] = function guarded(target, ...rest) {
      const href = typeof target === 'string' || target instanceof URL ? target
        : `${mod === https ? 'https' : 'http'}://${target?.hostname ?? target?.host ?? 'localhost'}${target?.path ?? '/'}`
      check(href)
      return real.call(this, target, ...rest)
    }
  }
}

globalThis.__networkGuard = {
  attempts,
  // Run fn with blocking expected (for the guard's own test).
  async expectBlocked(fn) {
    expecting++
    try { return await fn() } finally { expecting-- }
  },
}

process.on('exit', () => {
  const unexpected = attempts.filter((a) => !a.expected)
  if (unexpected.length) {
    console.error(`NETWORK GUARD: ${unexpected.length} blocked call(s) to the Anthropic API or the MaddenAI proxy:\n${unexpected.map((a) => `  ${a.url}`).join('\n')}`)
    process.exitCode = 1
  }
})
