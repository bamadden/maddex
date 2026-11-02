// Child process for tests/dataSources.test.mjs: loads the real equity and
// calendar services with whatever keys MADDEX_TEST_ENV sets, answers every
// fetch locally (nothing reaches the network) and reports which URLs the
// code tried to reach.
const calls = []
globalThis.fetch = async (input) => {
  calls.push(String(input?.url ?? input))
  return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
}
const store = new Map()
globalThis.localStorage ??= { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size } }
globalThis.window ??= globalThis

const api = await import('../../src/services/api.js')
const cal = await import('../../src/services/calendarService.js')
const tried = {}
const attempt = async (name, fn) => { try { await fn(); tried[name] = 'ok' } catch (e) { tried[name] = `${e.name}: ${e.message}` } }
await attempt('fetchYahooQuote', () => api.fetchYahooQuote('BHP.AX'))
await attempt('fetchYahooBatch', () => api.fetchYahooBatch(['BHP.AX', 'CBA.AX']))
await attempt('fetchYahooHistory', () => api.fetchYahooHistory('BHP.AX'))
await attempt('fetchIndexQuotes', () => api.fetchIndexQuotes(['^AXJO']))
await attempt('fetchBatch', () => api.fetchBatch(['BHP.AX']))
await attempt('getEconomicCalendar', () => cal.getEconomicCalendar())
console.log(JSON.stringify({
  usingMock: api.USING_MOCK_DATA,
  equitySource: api.EQUITY_SOURCE,
  fmpRequests: calls.filter((u) => /financialmodelingprep\.com/i.test(u)),
  tried,
}))
