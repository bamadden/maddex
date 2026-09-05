import { useState } from 'react'
import { ALERT_TYPES, loadAlerts, createAlert, deleteAlert } from '../../services/alertsService'
import { MOCK_ASX_STOCKS, MOCK_US_STOCKS, MOCK_CRYPTO } from '../../services/mockData'

// Suggestions for the asset-picker datalist. ASX keys already carry the .AX
// suffix alertsService/getMockFMPRow expect; crypto tickers are matched
// against alertsService's generic synthetic fallback (MOCK_CRYPTO's own
// current_price isn't wired into getMockFMPRow), which is deterministic but
// won't line up with the price shown elsewhere for that coin — a known
// limitation of reusing the equities mock lookup for crypto alerts.
const ALL_SYMBOLS = [
  ...Object.keys(MOCK_ASX_STOCKS),
  ...Object.keys(MOCK_US_STOCKS),
  ...MOCK_CRYPTO.map((c) => c.symbol.toUpperCase()),
]

const QUICK_TEMPLATES = [
  { label: 'Notify me when any watchlist stock moves >2%', build: () => ({ type: 'SESSION_MOVE', symbol: null, value: 2 }) },
  { label: 'Alert me before RBA decision', build: () => ({ type: 'ECONOMIC_EVENT', value: 1 }) },
  { label: 'Notify me when BTC drops below A$80,000', build: () => ({ type: 'PRICE', symbol: 'BTC', condition: 'below', value: 80000 }) },
]

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
}

function summarise(alert) {
  const meta = ALERT_TYPES.find((t) => t.key === alert.type)
  const cond = alert.condition ? `${alert.condition} ` : ''
  const unit = meta?.unit === '$' ? 'A$' : ''
  const suffix = meta?.unit && meta.unit !== '$' ? meta.unit : ''
  return `${cond}${alert.value != null ? `${unit}${alert.value}${suffix}` : ''}`.trim() || '—'
}

export default function AlertsModule({ onClose }) {
  const [alerts, setAlerts] = useState(() => loadAlerts())
  const [type, setType] = useState('PRICE')
  const [symbol, setSymbol] = useState('')
  const [condition, setCondition] = useState('above')
  const [value, setValue] = useState('')

  const meta = ALERT_TYPES.find((t) => t.key === type)
  const refresh = () => setAlerts(loadAlerts())

  const handleSave = (e) => {
    e.preventDefault()
    if (value === '' || Number.isNaN(Number(value))) return
    if ((meta.needsSymbol === true) && !symbol.trim()) return
    createAlert({
      type,
      symbol: symbol.trim() || null,
      condition: meta.needsCondition ? condition : null,
      value,
    })
    refresh()
    setSymbol('')
    setValue('')
  }

  const addTemplate = (tpl) => {
    createAlert(tpl.build())
    refresh()
  }

  const handleDelete = (id) => {
    deleteAlert(id)
    refresh()
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-terminal-panel border border-terminal-border w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
          <span className="text-2xs text-terminal-gold font-bold tracking-widest">MANAGE ALERTS</span>
          <button onClick={onClose} className="text-terminal-text-dim hover:text-terminal-red text-sm leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick-add templates */}
          <div>
            <div className="text-2xs text-terminal-text-dim font-bold tracking-widest mb-1.5">QUICK ADD</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  onClick={() => addTemplate(tpl)}
                  className="text-2xs text-terminal-text border border-terminal-border px-2 py-1 hover:border-terminal-gold hover:text-terminal-gold transition-colors"
                >+ {tpl.label}</button>
              ))}
            </div>
          </div>

          {/* Create form */}
          <form onSubmit={handleSave} className="border border-terminal-border p-3 space-y-2">
            <div className="text-2xs text-terminal-text-dim font-bold tracking-widest mb-1">CREATE ALERT</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-2xs text-terminal-text-dim">Alert Type</span>
                <select
                  value={type}
                  onChange={(e) => { setType(e.target.value); setCondition('above') }}
                  className="bg-terminal-bg border border-terminal-border text-2xs text-terminal-text px-2 py-1"
                >
                  {ALERT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>

              {meta.needsSymbol !== false && (
                <label className="flex flex-col gap-1">
                  <span className="text-2xs text-terminal-text-dim">Asset {meta.needsSymbol === 'optional' ? '(optional — all watchlist)' : ''}</span>
                  <input
                    list="alert-symbols"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. BHP.AX"
                    className="bg-terminal-bg border border-terminal-border text-2xs text-terminal-text px-2 py-1"
                  />
                  <datalist id="alert-symbols">
                    {ALL_SYMBOLS.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </label>
              )}

              {meta.needsCondition && (
                <label className="flex flex-col gap-1">
                  <span className="text-2xs text-terminal-text-dim">Condition</span>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="bg-terminal-bg border border-terminal-border text-2xs text-terminal-text px-2 py-1"
                  >
                    <option value="above">above</option>
                    <option value="below">below</option>
                  </select>
                </label>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-2xs text-terminal-text-dim">Value {meta.unit && `(${meta.unit === '$' ? 'A$' : meta.unit})`}</span>
                <input
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  className="bg-terminal-bg border border-terminal-border text-2xs text-terminal-text px-2 py-1"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-2xs text-terminal-text-dim">Notification</span>
                <select disabled className="bg-terminal-bg border border-terminal-border text-2xs text-terminal-text-dim px-2 py-1 opacity-60 cursor-not-allowed">
                  <option>App (Email coming soon)</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              className="text-2xs text-terminal-gold border border-terminal-gold px-3 py-1 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
            >SAVE ALERT</button>
          </form>

          {/* Alert list */}
          <div>
            <div className="text-2xs text-terminal-text-dim font-bold tracking-widest mb-1.5">YOUR ALERTS ({alerts.length})</div>
            {alerts.length === 0 ? (
              <div className="text-2xs text-terminal-text-dim/60 text-center py-6">No alerts yet — create one above</div>
            ) : (
              <table className="w-full text-2xs">
                <thead>
                  <tr className="border-b border-terminal-border text-terminal-text-dim text-left">
                    <th className="py-1 font-normal">Status</th>
                    <th className="py-1 font-normal">Asset</th>
                    <th className="py-1 font-normal">Condition</th>
                    <th className="py-1 font-normal">Created</th>
                    <th className="py-1 font-normal text-right">.</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id} className="border-b border-terminal-border/40">
                      <td className="py-1.5">
                        {a.triggered
                          ? <span className="text-terminal-gold" title="Triggered">⚑ triggered</span>
                          : <span className="text-terminal-green" title="Active">● active</span>}
                      </td>
                      <td className="py-1.5 text-terminal-text-bright">{a.symbol ?? 'ANY'}</td>
                      <td className="py-1.5 text-terminal-text">
                        {ALERT_TYPES.find((t) => t.key === a.type)?.label} {summarise(a)}
                      </td>
                      <td className="py-1.5 text-terminal-text-dim">{fmtDate(a.createdAt)}</td>
                      <td className="py-1.5 text-right">
                        <button onClick={() => handleDelete(a.id)} className="text-terminal-text-dim hover:text-terminal-red transition-colors">DELETE</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
