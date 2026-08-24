import { useState } from 'react'

const BASE_URL = 'https://maddex-app.vercel.app/api/terminal-api'

const ENDPOINTS = [
  {
    name: 'quote', method: 'GET', desc: 'Latest quote for a single symbol.',
    params: [['symbol', 'required', 'e.g. BHP.AX']],
    example: `${BASE_URL}?endpoint=quote&symbol=BHP.AX`,
    response: `{
  "symbol": "BHP.AX",
  "price": 68.42,
  "change": 0.51,
  "changePercent": 0.75,
  "volume": 9800000,
  "marketCap": 215000000000,
  "timestamp": "2026-08-24T05:00:00.000Z",
  "source": "Maddex Terminal API v1",
  "disclaimer": "General information only. Not financial advice. Illustrative demo data."
}`,
  },
  {
    name: 'batch', method: 'GET', desc: 'Quotes for up to 50 symbols in one call.',
    params: [['symbols', 'required', 'comma-separated, e.g. BHP.AX,CBA.AX,AAPL']],
    example: `${BASE_URL}?endpoint=batch&symbols=BHP.AX,CBA.AX,AAPL`,
    response: `{
  "quotes": [
    { "symbol": "BHP.AX", "price": 68.42, "change": 0.51, "changePercent": 0.75, "volume": 9800000, "marketCap": 215000000000 },
    { "symbol": "CBA.AX", "price": 172.00, "change": -0.72, "changePercent": -0.42, "volume": 2100000, "marketCap": 290000000000 }
  ],
  "timestamp": "2026-08-24T05:00:00.000Z",
  "count": 2
}`,
  },
  {
    name: 'history', method: 'GET', desc: 'OHLCV history for a symbol.',
    params: [['symbol', 'required', 'e.g. BHP.AX'], ['days', 'optional', '1-365, default 30']],
    example: `${BASE_URL}?endpoint=history&symbol=BHP.AX&days=30`,
    response: `{
  "symbol": "BHP.AX",
  "days": 30,
  "data": [ { "date": "2026-07-25", "open": 67.1, "high": 67.9, "low": 66.8, "close": 67.6, "volume": 8900000 }, ... ],
  "timestamp": "2026-08-24T05:00:00.000Z"
}`,
  },
  {
    name: 'indices', method: 'GET', desc: 'All tracked index levels.',
    params: [],
    example: `${BASE_URL}?endpoint=indices`,
    response: `{
  "indices": [ { "symbol": "^AXJO", "name": "ASX 200", "price": 9650.0, "changePct": 0.42, "currency": "AUD" }, ... ],
  "timestamp": "2026-08-24T05:00:00.000Z"
}`,
  },
  {
    name: 'sentiment', method: 'GET', desc: 'Current market sentiment score.',
    params: [],
    example: `${BASE_URL}?endpoint=sentiment`,
    response: `{
  "score": 72,
  "label": "CAUTIOUSLY BULLISH",
  "asxBias": "POSITIVE",
  "timestamp": "2026-08-24T05:00:00.000Z"
}`,
  },
]

const CODE_EXAMPLES = {
  curl: `curl "${BASE_URL}?endpoint=quote&symbol=BHP.AX" \\
  -H "x-maddex-api-key: YOUR_KEY"`,
  javascript: `const res = await fetch(
  "${BASE_URL}?endpoint=quote&symbol=BHP.AX",
  { headers: { "x-maddex-api-key": "YOUR_KEY" } }
);
const data = await res.json();`,
  python: `import requests

res = requests.get(
    "${BASE_URL}",
    params={"endpoint": "quote", "symbol": "BHP.AX"},
    headers={"x-maddex-api-key": "YOUR_KEY"},
)
data = res.json()`,
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="text-2xs text-terminal-gold border border-terminal-gold/40 px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors flex-shrink-0"
    >{copied ? 'COPIED ✓' : 'COPY'}</button>
  )
}

export default function APIDocsModal({ onClose }) {
  const [lang, setLang] = useState('curl')

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-terminal-panel border border-terminal-border w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
          <span className="text-2xs text-terminal-gold font-bold tracking-widest">MADDEX TERMINAL API · DOCS</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-red text-sm leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">AUTHENTICATION</div>
            <div className="text-2xs text-terminal-text leading-relaxed">
              Every request must include your API key in the <code className="text-terminal-gold">x-maddex-api-key</code> header.
              Requests without a valid key return <code className="text-terminal-gold">401</code>.
            </div>
          </div>

          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">RATE LIMITS</div>
            <div className="text-2xs text-terminal-text">Apex tier: <span className="font-bold">100 requests/minute</span>. Exceeding this returns <code className="text-terminal-gold">429</code>.</div>
          </div>

          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-2">ENDPOINTS</div>
            <div className="space-y-3">
              {ENDPOINTS.map((ep) => (
                <div key={ep.name} className="border border-terminal-border p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold text-terminal-bg bg-terminal-green px-1.5 py-0.5">{ep.method}</span>
                    <span className="text-2xs font-bold text-terminal-text-bright">?endpoint={ep.name}</span>
                  </div>
                  <div className="text-2xs text-terminal-text-dim mt-1">{ep.desc}</div>
                  {ep.params.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {ep.params.map(([p, req, desc]) => (
                        <div key={p} className="text-2xs">
                          <span className="text-terminal-gold font-mono">{p}</span>
                          <span className="text-terminal-text-dim"> ({req}) — {desc}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <code className="text-2xs text-terminal-text-dim bg-terminal-bg px-1.5 py-1 flex-1 overflow-x-auto whitespace-nowrap">{ep.example}</code>
                    <CopyButton text={ep.example} />
                  </div>
                  <details className="mt-1.5">
                    <summary className="text-2xs text-terminal-text-dim cursor-pointer hover:text-terminal-gold">Example response</summary>
                    <pre className="text-2xs text-terminal-text-dim bg-terminal-bg p-2 mt-1 overflow-x-auto whitespace-pre">{ep.response}</pre>
                  </details>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-2xs text-terminal-gold font-bold tracking-widest mb-1.5">CODE EXAMPLES</div>
            <div className="flex gap-0 border border-terminal-border mb-2 w-fit">
              {Object.keys(CODE_EXAMPLES).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-2.5 py-1 text-2xs font-bold ${lang === l ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
                >{l.toUpperCase()}</button>
              ))}
            </div>
            <div className="relative">
              <pre className="text-2xs text-terminal-text bg-terminal-bg p-3 overflow-x-auto whitespace-pre border border-terminal-border">{CODE_EXAMPLES[lang]}</pre>
              <div className="absolute top-2 right-2"><CopyButton text={CODE_EXAMPLES[lang]} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
