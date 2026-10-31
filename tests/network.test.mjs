// The network guard (tests/setup/networkGuard.mjs) must be loaded, and must
// refuse the Anthropic API and the MaddenAI proxy.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import https from 'node:https'

const guard = globalThis.__networkGuard

test('the network guard is loaded for every test file', () => {
  assert.ok(guard, 'run tests with: node --test --import ./tests/setup/networkGuard.mjs')
})

test('fetch to the Anthropic API is refused', async () => {
  await guard.expectBlocked(async () => {
    await assert.rejects(fetch('https://api.anthropic.com/v1/messages', { method: 'POST', body: '{}' }), /NETWORK GUARD/)
  })
})

test('fetch to the MaddenAI proxy is refused', async () => {
  await guard.expectBlocked(async () => {
    await assert.rejects(fetch('http://localhost:5173/api/claude', { method: 'POST', body: '{}' }), /NETWORK GUARD/)
  })
})

test('https.request to the Anthropic API is refused (the SDK path on older Node)', async () => {
  await guard.expectBlocked(async () => {
    assert.throws(() => https.request({ hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST' }), /NETWORK GUARD/)
  })
})

test('the Anthropic SDK itself is refused', async () => {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: 'test-key-not-real', maxRetries: 0 })
  await guard.expectBlocked(async () => {
    await assert.rejects(client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1, messages: [{ role: 'user', content: 'x' }] }), /NETWORK GUARD|Connection error/)
  })
  assert.ok(guard.attempts.some((a) => /anthropic\.com/.test(a.url)), 'the SDK call was seen by the guard')
})

test('fetch to the shared daily AI endpoint is refused', async () => {
  await guard.expectBlocked(async () => {
    await assert.rejects(fetch('http://localhost:5173/api/ai-daily?kind=sentiment&day=2026-10-31'), /NETWORK GUARD/)
  })
})
