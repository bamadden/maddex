import { useMemo, useState } from 'react'
import { ACTION_TYPES, ASX_LISTINGS, CORPORATE_ACTIONS, CORPORATE_ACTIONS_AS_OF } from '../../data/corporateActions'
import { dispatchAskAI } from '../../utils/askAI'

// CORPORATE ACTIONS — dividends, results, AGMs, raisings, splits and new
// listings, from the hand-entered, sourced list in data/corporateActions.
// A category with nothing announced says so; nothing is filled in.

const TYPE = Object.fromEntries(ACTION_TYPES.map((t) => [t.key, t]))
const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtAud = (n) => (n >= 1e6 ? `A$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : `A$${n.toLocaleString('en-AU')}`)

export default function CorporateActions() {
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)
  const today = new Date().toLocaleDateString('en-CA')

  const rows = useMemo(() => {
    const listings = ASX_LISTINGS.filter((l) => l.date && l.date >= today).map((l) => ({
      date: l.date, type: 'listing', ticker: `${l.code}.AX`, company: l.company,
      detail: `Proposed ASX listing. Raising ${fmtAud(l.raiseAud)} at A$${l.price.toFixed(2)} a share. ${l.note}.`,
      source: l.source, sourceUrl: l.sourceUrl,
    }))
    return [...CORPORATE_ACTIONS.filter((a) => a.date >= today), ...listings]
      .filter((a) => filter === 'all' || a.type === filter)
      .sort((a, b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company))
  }, [filter, today])

  const byDate = rows.reduce((m, r) => ((m[r.date] ??= []).push(r), m), {})
  const key = (r) => `${r.date}-${r.ticker}-${r.type}`

  return (
    <div className="mt-6 border border-terminal-border">
      <div className="px-3 py-2 border-b border-terminal-border/50 flex items-center gap-2 flex-wrap">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest">CORPORATE ACTIONS</span>
        <span className="text-[9px] font-bold px-1.5 border border-terminal-gold/50 text-terminal-gold" title="Dates from company calendars and the ASX; companies can move them">INDICATIVE</span>
        <span className="text-2xs text-terminal-text-dim">from company calendars and the ASX · as at {fmtDate(CORPORATE_ACTIONS_AS_OF)}</span>
      </div>
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-terminal-border/50">
        {[{ key: 'all', label: 'ALL' }, ...ACTION_TYPES].map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`text-[9px] font-bold px-1.5 py-0.5 border transition-colors ${filter === t.key ? 'bg-terminal-gold text-terminal-bg border-terminal-gold' : 'text-terminal-text-dim border-terminal-border hover:border-terminal-gold/50'}`}
          >{t.label}</button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="px-3 py-5 text-center text-2xs text-terminal-text-dim">
          {filter === 'raising' || filter === 'split'
            ? `No ${TYPE[filter].label.toLowerCase()} announced and tracked. Check ASX announcements for anything new.`
            : 'Nothing upcoming in this category.'}
        </div>
      ) : (
        <div className="divide-y divide-terminal-border/30">
          {Object.entries(byDate).map(([date, items]) => (
            <div key={date} className="flex gap-3 px-3 py-2">
              <div className="w-20 flex-shrink-0 text-2xs text-terminal-text-dim pt-0.5">{fmtDate(date)}</div>
              <div className="flex-1 min-w-0 space-y-1">
                {items.map((r) => {
                  const t = TYPE[r.type]
                  const isOpen = open === key(r)
                  return (
                    <div key={key(r)}>
                      <button onClick={() => setOpen(isOpen ? null : key(r))} className="w-full flex items-center gap-2 text-left hover:text-terminal-gold">
                        <span className="text-[9px] font-bold w-20 flex-shrink-0" style={{ color: t.colour }}>{t.short}</span>
                        <span className="text-2xs font-mono text-terminal-text-bright w-10 flex-shrink-0">{r.ticker.replace(/\.AX$/, '')}</span>
                        <span className="text-2xs text-terminal-text truncate">{r.company}</span>
                      </button>
                      {isOpen && (
                        <div className="ml-[88px] mt-1 mb-1 text-2xs text-terminal-text-dim leading-relaxed">
                          <div>{r.detail}</div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <button
                              onClick={() => dispatchAskAI({
                                name: r.company, ticker: r.ticker, date: r.date,
                                instruction: `${r.company} (${r.ticker.replace(/\.AX$/, '')}): ${r.detail} What should an Australian investor understand about this event, and what usually matters around it? General information only.`,
                              }, { rawPrompt: true })}
                              className="text-[9px] font-bold text-terminal-gold border border-terminal-gold/50 px-1.5 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                            >ASK MADDENAI</button>
                            <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] text-terminal-gold/80 hover:underline">{r.source} ↗</a>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
