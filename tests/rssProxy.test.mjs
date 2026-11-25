// The news-feed proxy follows redirects only to allowed hosts (WS6, 26 Nov
// 2026; docs/audit/security.md finding 5). Mocked fetch only.
import test from 'node:test'
import assert from 'node:assert/strict'
import handler, { fetchAllowed, hostAllowed } from '../api/rss.js'

const RSS = '<rss><channel><item><title>RBA holds</title><link>https://www.rba.gov.au/x</link></item></channel></rss>'
const ok = (body = RSS) => ({ status: 200, ok: true, headers: new Headers(), text: async () => body })
const redirect = (location, status = 301) => ({ status, ok: false, headers: new Headers(location ? { location } : {}), text: async () => '' })

function fakeRes() {
  const r = { statusCode: null, headers: {}, body: null }
  r.status = (c) => { r.statusCode = c; return r }
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; return r }
  r.json = (b) => { r.body = b; return r }
  return r
}

function scripted(map) {
  const calls = []
  const f = async (url, init) => { calls.push({ url, redirect: init.redirect }); const v = map[url]; if (!v) throw new Error(`unexpected fetch ${url}`); return v }
  return { f, calls }
}

test('a redirect within allowed hosts is followed, by hand, and the feed is parsed', async () => {
  const { f, calls } = scripted({
    'http://feeds.bbci.co.uk/news/business/rss.xml': redirect('https://feeds.bbci.co.uk/news/business/rss.xml'),
    'https://feeds.bbci.co.uk/news/business/rss.xml': ok(),
  })
  const res = fakeRes()
  await handler({ query: { url: 'http://feeds.bbci.co.uk/news/business/rss.xml' } }, res, f)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.items[0].title, 'RBA holds')
  assert.ok(calls.every((c) => c.redirect === 'manual'), 'the platform never follows a redirect itself')
})

test('a redirect to a host off the allowlist is refused, and that host is never fetched', async () => {
  for (const loc of ['https://evil.example/feed', 'http://169.254.169.254/latest/meta-data/', 'http://localhost:3000/', 'file:///etc/passwd', 'https://rba.gov.au.evil.example/x']) {
    const { f, calls } = scripted({ 'https://www.rba.gov.au/rss/rss-cb-speeches.xml': redirect(loc, 302) })
    const res = fakeRes()
    await handler({ query: { url: 'https://www.rba.gov.au/rss/rss-cb-speeches.xml' } }, res, f)
    assert.equal(res.statusCode, 502, loc)
    assert.match(res.body.error, /not allowed/, loc)
    assert.equal(calls.length, 1, `${loc} was fetched`)
  }
})

test('a relative redirect stays on its host; loops and a missing Location are refused', async () => {
  const rel = scripted({ 'https://www.abc.net.au/a': redirect('/b', 307), 'https://www.abc.net.au/b': ok() })
  assert.equal((await fetchAllowed('https://www.abc.net.au/a', {}, rel.f)).url.href, 'https://www.abc.net.au/b')
  const loop = scripted({ 'https://www.abc.net.au/a': redirect('https://www.abc.net.au/a') })
  assert.match((await fetchAllowed('https://www.abc.net.au/a', {}, loop.f)).error, /More than 3 redirects/)
  assert.equal(loop.calls.length, 4)
  const none = scripted({ 'https://www.abc.net.au/a': redirect(null) })
  assert.match((await fetchAllowed('https://www.abc.net.au/a', {}, none.f)).error, /without a Location/)
})

test('the allowlist matches whole host labels only', () => {
  assert.ok(hostAllowed('feeds.bbci.co.uk'))
  assert.ok(hostAllowed('rba.gov.au'))
  assert.ok(!hostAllowed('evilrba.gov.au'))
  assert.ok(!hostAllowed('rba.gov.au.evil.example'))
})

test('the first URL is still checked before any fetch', async () => {
  const { f, calls } = scripted({})
  const res = fakeRes()
  await handler({ query: { url: 'https://evil.example/feed' } }, res, f)
  assert.equal(res.statusCode, 403)
  assert.equal(calls.length, 0)
})
