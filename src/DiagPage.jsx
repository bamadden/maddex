import { useEffect, useState } from 'react'

const TESTS = [
  {
    id: 'stooq_spx',
    label: 'Stooq (proxy) — S&P 500 quote',
    url: '/api/stooq/q/l/?s=^spx&f=sd2t2ohlcv&h&e=csv',
    run: async () => {
      const r    = await fetch('/api/stooq/q/l/?s=%5Espx&f=sd2t2ohlcv&h&e=csv')
      const text = await r.text()
      const lines = text.trim().split('\n')
      const headers = lines[0]?.split(',') ?? []
      const vals    = lines[1]?.split(',') ?? []
      const row = {}; headers.forEach((h, i) => { row[h.trim().toLowerCase()] = vals[i]?.trim() })
      return { status: r.status, ok: r.ok && !!row.close && row.close !== 'N/D', close: row.close, open: row.open, date: row.date }
    },
  },
  {
    id: 'stooq_aord',
    label: 'Stooq (proxy) — ASX 200 (^aord) quote',
    url: '/api/stooq/q/l/?s=^aord&f=sd2t2ohlcv&h&e=csv',
    run: async () => {
      const r    = await fetch('/api/stooq/q/l/?s=%5Eaord&f=sd2t2ohlcv&h&e=csv')
      const text = await r.text()
      const lines = text.trim().split('\n')
      const headers = lines[0]?.split(',') ?? []
      const vals    = lines[1]?.split(',') ?? []
      const row = {}; headers.forEach((h, i) => { row[h.trim().toLowerCase()] = vals[i]?.trim() })
      return { status: r.status, ok: r.ok && !!row.close && row.close !== 'N/D', close: row.close, date: row.date }
    },
  },
  {
    id: 'stooq_bhp',
    label: 'Stooq (proxy) — BHP.AU (ASX stock)',
    url: '/api/stooq/q/l/?s=bhp.au&f=sd2t2ohlcv&h&e=csv',
    run: async () => {
      const r    = await fetch('/api/stooq/q/l/?s=bhp.au&f=sd2t2ohlcv&h&e=csv')
      const text = await r.text()
      const lines = text.trim().split('\n')
      const headers = lines[0]?.split(',') ?? []
      const vals    = lines[1]?.split(',') ?? []
      const row = {}; headers.forEach((h, i) => { row[h.trim().toLowerCase()] = vals[i]?.trim() })
      return { status: r.status, ok: r.ok && !!row.close && row.close !== 'N/D', close: row.close, date: row.date }
    },
  },
  {
    id: 'stooq_history',
    label: 'Stooq (proxy) — AAPL.US 3mo history',
    url: '/api/stooq/q/d/l/?s=aapl.us&d1=20260101&d2=20260614&i=d',
    run: async () => {
      const r    = await fetch('/api/stooq/q/d/l/?s=aapl.us&d1=20260101&d2=20260614&i=d')
      const text = await r.text()
      const lines = text.trim().split('\n').filter(l => l && !l.startsWith('Symbol'))
      return { status: r.status, ok: r.ok && lines.length > 1, bars: lines.length - 1 }
    },
  },
  {
    id: 'frankfurter',
    label: 'Frankfurter (proxy) — AUD rates',
    url: '/api/frankfurter/latest?from=AUD',
    run: async () => {
      const r    = await fetch('/api/frankfurter/latest?from=AUD')
      const body = await r.json()
      return { status: r.status, ok: r.ok, hasUSD: !!body?.rates?.USD, rateCount: Object.keys(body?.rates ?? {}).length, usdRate: body?.rates?.USD }
    },
  },
  {
    id: 'frankfurter_metals',
    label: 'Frankfurter (proxy) — Metals XAU/XAG from USD',
    url: '/api/frankfurter/latest?from=USD&to=XAU,XAG',
    run: async () => {
      const r    = await fetch('/api/frankfurter/latest?from=USD&to=XAU,XAG')
      const text = await r.text()
      let body
      try { body = JSON.parse(text) } catch { body = text }
      return { status: r.status, ok: r.ok, hasXAU: !!body?.rates?.XAU, hasXAG: !!body?.rates?.XAG, body }
    },
  },
  {
    id: 'coingecko',
    label: 'CoinGecko (direct) — Bitcoin price AUD',
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=aud',
    run: async () => {
      const r    = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=aud')
      const body = await r.json()
      return { status: r.status, ok: r.ok, btcAud: body?.bitcoin?.aud }
    },
  },
  {
    id: 'opensky',
    label: 'OpenSky (proxy) — AU region flights',
    url: '/api/opensky/api/states/all?lamin=-45&lomin=110&lamax=-10&lomax=155',
    run: async () => {
      const r = await fetch('/api/opensky/api/states/all?lamin=-45&lomin=110&lamax=-10&lomax=155')
      if (!r.ok) return { status: r.status, ok: false, body: await r.text() }
      const body = await r.json()
      return { status: r.status, ok: r.ok, stateCount: body?.states?.length ?? 0, time: body?.time }
    },
  },
  {
    id: 'rba',
    label: 'RBA Statistics (proxy) — cash rate a2-1',
    url: '/api/rba/statistics/tables/a2-1/latest',
    run: async () => {
      const r    = await fetch('/api/rba/statistics/tables/a2-1/latest')
      const text = await r.text()
      let body
      try { body = JSON.parse(text) } catch { body = text.slice(0, 300) }
      return { status: r.status, ok: r.ok, preview: typeof body === 'string' ? body : JSON.stringify(body).slice(0, 300) }
    },
  },
]

function ResultRow({ test }) {
  const [state, setState] = useState('idle')
  const [result, setResult] = useState(null)
  const [err, setErr]       = useState(null)
  const [ms, setMs]         = useState(null)

  const run = async () => {
    setState('running'); setResult(null); setErr(null)
    const t0 = Date.now()
    try {
      const r = await test.run()
      setMs(Date.now() - t0); setResult(r); setState('done')
    } catch (e) {
      setMs(Date.now() - t0); setErr(e.message); setState('error')
    }
  }

  useEffect(() => { run() }, [])

  const isOk = state === 'done' && result && result.ok !== false

  return (
    <div className={`border rounded p-3 mb-3 font-mono text-sm ${
      state === 'running' ? 'border-yellow-600 bg-yellow-950/30' :
      isOk               ? 'border-green-600 bg-green-950/20' :
                           'border-red-600 bg-red-950/20'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-white">{test.label}</span>
        <div className="flex items-center gap-2">
          {state !== 'idle' && (
            <button onClick={run} className="text-xs px-2 py-0.5 border border-gray-600 text-gray-400 hover:border-yellow-400 hover:text-yellow-400 rounded">
              ↺ retry
            </button>
          )}
          <span className={`text-xs px-2 py-0.5 rounded font-bold ${
            state === 'running' ? 'bg-yellow-700 text-yellow-100' :
            isOk               ? 'bg-green-700 text-green-100' :
                                  'bg-red-700 text-red-100'
          }`}>
            {state === 'running' ? '⟳ RUNNING' : isOk ? '✓ OK' : state === 'error' ? '✗ NETWORK ERROR' : '✗ API ERROR'}
            {ms != null && ` ${ms}ms`}
          </span>
        </div>
      </div>
      {test.url && (
        <div className="text-gray-400 text-xs mb-2 break-all">URL: {test.url}</div>
      )}
      {state === 'error' && (
        <div className="text-red-400 text-xs"><span className="font-bold">ERROR:</span> {err}</div>
      )}
      {state === 'done' && result && (
        <pre className={`whitespace-pre-wrap break-all text-xs leading-relaxed max-h-48 overflow-auto rounded p-2 ${
          isOk ? 'bg-green-950/40 text-green-200' : 'bg-red-950/40 text-red-200'
        }`}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function DiagPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-yellow-400 mb-1">▲ MADDEX — API DIAGNOSTIC</h1>
        <p className="text-gray-400 text-sm mb-2">
          All calls via Vite proxy (localhost). Tests Stooq, Frankfurter, CoinGecko, OpenSky, RBA.
        </p>
        <p className="text-gray-500 text-xs mb-6">
          Dev server: <span className="text-yellow-300">{window.location.origin}</span>
          {' · '}Access at <span className="text-yellow-300">/?diag</span>
        </p>
        {TESTS.map((t) => <ResultRow key={t.id} test={t} />)}
      </div>
    </div>
  )
}
