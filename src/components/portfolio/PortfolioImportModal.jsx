import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TEMPLATE_CSV, validateCsv, rowToHolding, downloadText,
} from '../../services/portfolioCsv'

// CSV import: pick a file → preview every row with its verdict → choose what
// happens to symbols already held → confirm. Nothing touches the portfolio
// until CONFIRM IMPORT.

const MERGE = [
  { id: 'lot',     label: 'ADD AS NEW LOT', hint: 'Keeps both purchases and their cost basis' },
  { id: 'replace', label: 'REPLACE',        hint: 'Removes the existing lots of this symbol' },
  { id: 'skip',    label: 'SKIP',           hint: 'Leaves the existing holding untouched' },
]

// Instructions only — Maddex has no broker connection. Menu paths change
// between broker app versions; the column mapping is the part that matters.
const BROKERS = [
  {
    name: 'CommSec',
    text: 'Export from My Portfolio → Download as CSV. Map: Code → Symbol, Qty → Units, Avg Cost → Purchase Price. Maddex recognises those three headers as-is; add a Purchase Date column if the export has none.',
  },
  {
    name: 'SelfWealth',
    text: 'Portfolio → Export. Check the header row against the template (Symbol, Units, Purchase Price, Purchase Date) and rename any column that differs.',
  },
  {
    name: 'Pearler',
    text: 'Holdings → Export CSV. Use the average/purchase price column as Purchase Price — not "Market Price", which is today\'s price rather than what you paid.',
  },
]

const keyOf = (h) => `${h.type}:${h.symbol}`

export default function PortfolioImportModal({ holdings, positionLimit = null, onConfirm, onClose }) {
  const fileRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState(null)     // { error } | { rows }
  const [merge, setMerge] = useState({})         // symbolKey → lot | replace | skip
  const [showBrokers, setShowBrokers] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const held = useMemo(() => new Set(holdings.map(keyOf)), [holdings])

  const onFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileName(file.name)
    setMerge({})
    if (!/\.csv$/i.test(file.name)) { setResult({ error: 'Choose a .csv file.' }); return }
    if (file.size > 1_000_000) { setResult({ error: 'That file is over 1 MB — a holdings export is a few KB.' }); return }
    const reader = new FileReader()
    reader.onload = () => setResult(validateCsv(String(reader.result)))
    reader.onerror = () => setResult({ error: 'The file could not be read.' })
    reader.readAsText(file)
  }

  // Final verdict per row, with the merge choices and the position limit
  // applied — the preview shows exactly what CONFIRM will do.
  const plan = useMemo(() => {
    if (!result?.rows) return null
    const positions = new Set(held)
    const replaceKeys = new Set()
    const rows = result.rows.map((r) => {
      if (!r.valid) return { ...r, outcome: 'invalid' }
      const k = keyOf(r)
      const choice = held.has(k) ? (merge[k] ?? 'lot') : null
      if (choice === 'skip') return { ...r, outcome: 'skip', note: 'Already held — skipped' }
      if (!positions.has(k) && positionLimit != null && positions.size >= positionLimit) {
        return { ...r, outcome: 'limit', note: `Over the ${positionLimit}-position limit — upgrade to Prime for unlimited` }
      }
      positions.add(k)
      if (choice === 'replace') replaceKeys.add(k)
      return { ...r, outcome: 'add', note: choice === 'replace' ? 'Replaces existing lots' : choice === 'lot' ? 'Added as a new lot' : null }
    })
    const add = rows.filter((r) => r.outcome === 'add')
    return {
      rows,
      add,
      replaceKeys,
      invalid: rows.filter((r) => r.outcome === 'invalid').length,
      skipped: rows.filter((r) => r.outcome === 'skip' || r.outcome === 'limit').length,
    }
  }, [result, held, merge, positionLimit])

  const conflicts = useMemo(() => {
    if (!result?.rows) return []
    return [...new Set(result.rows.filter((r) => r.valid && held.has(keyOf(r))).map(keyOf))]
  }, [result, held])

  const confirm = () => {
    if (!plan?.add.length) return
    const seed = Date.now()
    onConfirm({
      add: plan.add.map((r, i) => rowToHolding(r, `${seed}-${i}`)),
      replaceKeys: plan.replaceKeys,
      skipped: plan.skipped + plan.invalid,
      replaced: plan.replaceKeys.size,
    })
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Import portfolio from CSV"
        className="bg-terminal-panel border border-terminal-border w-full max-w-3xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
          <span className="text-2xs text-terminal-gold font-bold tracking-widest">IMPORT HOLDINGS FROM CSV</span>
          <button onClick={onClose} aria-label="Close" className="text-terminal-text-dim hover:text-terminal-red text-sm leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Step 1 — file */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="text-2xs px-3 py-1.5 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold tracking-wide"
            >CHOOSE CSV FILE</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} data-testid="csv-input" />
            <button
              onClick={() => downloadText(TEMPLATE_CSV, 'maddex-portfolio-template.csv')}
              className="text-2xs px-3 py-1.5 border border-terminal-border text-terminal-text-dim hover:text-terminal-gold hover:border-terminal-gold transition-colors tracking-wide"
            >⤓ DOWNLOAD TEMPLATE</button>
            {fileName && <span className="text-2xs text-terminal-text-dim font-mono truncate max-w-[16rem]">{fileName}</span>}
          </div>
          <div className="text-2xs text-terminal-text-dim leading-relaxed">
            Columns: <span className="font-mono text-terminal-text">Symbol, Units, Purchase Price (AUD), Purchase Date</span>.
            Dates as YYYY-MM-DD or DD/MM/YYYY. Each row becomes its own lot, so separate purchases keep their own cost basis.
          </div>

          {result?.error && (
            <div className="border border-terminal-red/40 bg-terminal-red/5 px-3 py-2 text-xs text-terminal-red">{result.error}</div>
          )}

          {/* Step 2 — merge choices for symbols already held */}
          {conflicts.length > 0 && (
            <div className="border border-terminal-gold/30 bg-terminal-gold/5 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xs font-bold tracking-widest text-terminal-gold">ALREADY IN YOUR PORTFOLIO</span>
                <span className="text-2xs text-terminal-text-dim">Set all:</span>
                {MERGE.map((m) => (
                  <button key={m.id}
                    onClick={() => setMerge(Object.fromEntries(conflicts.map((k) => [k, m.id])))}
                    className="text-[9px] px-1.5 py-0.5 border border-terminal-border text-terminal-text-dim hover:text-terminal-gold hover:border-terminal-gold tracking-wide"
                  >{m.label}</button>
                ))}
              </div>
              {conflicts.map((k) => {
                const sym = k.split(':')[1]
                const current = merge[k] ?? 'lot'
                return (
                  <div key={k} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-terminal-text-bright w-16">{sym}</span>
                    <div className="flex" role="radiogroup" aria-label={`What to do with ${sym}`}>
                      {MERGE.map((m) => (
                        <button key={m.id} role="radio" aria-checked={current === m.id} title={m.hint}
                          onClick={() => setMerge((prev) => ({ ...prev, [k]: m.id }))}
                          className={`text-[9px] px-2 py-1 border -ml-px first:ml-0 font-bold tracking-wide transition-colors ${
                            current === m.id
                              ? 'border-terminal-gold text-terminal-bg bg-terminal-gold relative z-10'
                              : 'border-terminal-border text-terminal-text-dim hover:text-terminal-gold'
                          }`}
                        >[{m.label}]</button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Step 3 — preview */}
          {plan && (
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-1.5 text-2xs">
                <span className="font-bold tracking-widest text-terminal-text-dim">PREVIEW</span>
                <span className="text-terminal-green">✓ {plan.add.length} to import</span>
                {plan.invalid > 0 && <span className="text-terminal-red">✗ {plan.invalid} invalid</span>}
                {plan.skipped > 0 && <span className="text-terminal-gold">– {plan.skipped} skipped</span>}
              </div>
              <div className="border border-terminal-border overflow-x-auto">
                <table className="w-full text-2xs font-mono">
                  <thead>
                    <tr className="text-terminal-text-dim text-left border-b border-terminal-border">
                      <th className="px-2 py-1 font-normal w-6"></th>
                      <th className="px-2 py-1 font-normal">LINE</th>
                      <th className="px-2 py-1 font-normal">SYMBOL</th>
                      <th className="px-2 py-1 font-normal text-right">UNITS</th>
                      <th className="px-2 py-1 font-normal text-right">PRICE</th>
                      <th className="px-2 py-1 font-normal">DATE</th>
                      <th className="px-2 py-1 font-normal">NOTE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((r) => {
                      const tone = r.outcome === 'add' ? 'text-terminal-green' : r.outcome === 'invalid' ? 'text-terminal-red' : 'text-terminal-gold'
                      const mark = r.outcome === 'add' ? '✓' : r.outcome === 'invalid' ? '✗' : '–'
                      const note = r.outcome === 'invalid' ? r.errors.join(' · ') : [r.note, ...r.warnings].filter(Boolean).join(' · ')
                      return (
                        <tr key={r.line} className={`border-b border-terminal-border/40 ${r.outcome === 'invalid' ? 'bg-terminal-red/5' : ''}`}>
                          <td className={`px-2 py-1 font-bold ${tone}`}>{mark}</td>
                          <td className="px-2 py-1 text-terminal-text-dim">{r.line}</td>
                          <td className="px-2 py-1 text-terminal-text-bright">{r.display.symbol || '—'}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{r.display.units || '—'}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{r.display.price || '—'}</td>
                          <td className="px-2 py-1">{r.date ?? (r.display.date || '—')}</td>
                          <td className={`px-2 py-1 font-sans ${r.outcome === 'invalid' ? 'text-terminal-red' : 'text-terminal-text-dim'}`}>{note}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Broker guides */}
          <div className="border-t border-terminal-border pt-3">
            <button
              onClick={() => setShowBrokers((v) => !v)}
              aria-expanded={showBrokers}
              className="text-2xs font-bold tracking-widest text-terminal-text-dim hover:text-terminal-gold"
            >IMPORTING FROM YOUR BROKER? {showBrokers ? '▾' : '▸'}</button>
            {showBrokers && (
              <div className="mt-2 space-y-2">
                {BROKERS.map((b) => (
                  <div key={b.name} className="text-xs leading-relaxed">
                    <span className="font-bold text-terminal-text-bright">{b.name}: </span>
                    <span className="text-terminal-text-dim">{b.text}</span>
                  </div>
                ))}
                <div className="text-2xs text-terminal-text-dim/60">
                  Formatting guides only — Maddex does not connect to any broker. Menu names vary between app versions.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-terminal-border flex-shrink-0">
          <button onClick={onClose} className="text-2xs px-3 py-1.5 border border-terminal-border text-terminal-text-dim hover:text-terminal-text-bright tracking-wide">CANCEL</button>
          <button
            onClick={confirm}
            disabled={!plan?.add.length}
            className="text-2xs px-3 py-1.5 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold tracking-wide disabled:opacity-40 disabled:pointer-events-none"
          >CONFIRM IMPORT{plan?.add.length ? ` (${plan.add.length})` : ''}</button>
        </div>
      </div>
    </div>
  )
}
