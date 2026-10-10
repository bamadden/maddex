import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { fetchEquityQuotes } from '../../services/dataService'
import { USING_MOCK_DATA } from '../../services/api'
import { MOCK_ASX_STOCKS, MOCK_US_STOCKS } from '../../services/mockData'
import { AU_ETFS } from '../../data/etfData'

// ─── First-run setup ────────────────────────────────────────────────────────
//
// Five steps that each leave the user with something real — a stock on the
// watchlist, a question answered, an alert armed — rather than a tour that
// points at the furniture. Runs once, after the welcome screen; every step
// can be skipped, and EXIT SETUP ends it from anywhere.
//
// It operates the real terminal. The watchlist add, the MaddenAI question and
// the alert all go through the same store actions the app itself uses, so
// what the summary says was set up is what is actually there.

const TOTAL = 5
const AI_PROMPT = "What's the outlook for the ASX this week? Keep it brief — the three things that matter."

// Searchable universe for step 1: the tickers the terminal can price.
const UNIVERSE = [
  ...Object.entries(MOCK_ASX_STOCKS).map(([sym, s]) => ({ sym, name: s.name, ex: 'ASX' })),
  ...AU_ETFS.map((e) => ({ sym: `${e.ticker}.AX`, name: e.name, ex: 'ASX ETF' })),
  ...Object.entries(MOCK_US_STOCKS).map(([sym, s]) => ({ sym, name: s.name, ex: 'US' })),
]
const SUGGESTED = ['BHP.AX', 'CSL.AX', 'MQG.AX', 'WES.AX', 'VAS.AX', 'NVDA']

const fmtAud = (v) => `A$${v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── Spotlight: a scrim with a hole over the element being taught ────────────
// Four rects around the target rather than a dimmed overlay on top of it, so
// the real element underneath stays bright and — for the MaddenAI step — the
// reply can be read as it streams in.
function useRect(selector) {
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    if (!selector) return undefined
    const measure = () => {
      const el = document.querySelector(selector)
      const r = el?.getBoundingClientRect()
      setRect(r && r.width ? { top: r.top, left: r.left, width: r.width, height: r.height } : null)
    }
    measure()
    const id = setInterval(measure, 250)   // panels slide in; layout settles
    window.addEventListener('resize', measure)
    return () => { clearInterval(id); window.removeEventListener('resize', measure) }
  }, [selector])
  return selector ? rect : null
}

function Scrim({ hole, pad = 6 }) {
  const shade = 'rgba(2,6,14,0.78)'
  if (!hole) return <div className="fixed inset-0" style={{ background: shade }} />
  const t = Math.max(0, hole.top - pad), l = Math.max(0, hole.left - pad)
  const b = hole.top + hole.height + pad, r = hole.left + hole.width + pad
  return (
    <>
      <div className="fixed left-0 right-0 top-0" style={{ height: t, background: shade }} />
      <div className="fixed left-0 right-0 bottom-0" style={{ top: b, background: shade }} />
      <div className="fixed left-0" style={{ top: t, height: b - t, width: l, background: shade }} />
      <div className="fixed right-0" style={{ top: t, height: b - t, left: r, background: shade }} />
      <div className="fixed pointer-events-none pulse-gold"
        style={{ top: t, left: l, width: r - l, height: b - t, border: '2px solid #C9A84C', borderRadius: 3 }} />
    </>
  )
}

// ── Shared pieces ───────────────────────────────────────────────────────────
function Primary({ children, ...rest }) {
  return (
    <button {...rest}
      className="px-4 py-2 text-xs font-bold tracking-widest bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors disabled:opacity-40 disabled:pointer-events-none"
    >{children}</button>
  )
}
function Secondary({ children, ...rest }) {
  return (
    <button {...rest}
      className="px-4 py-2 text-xs tracking-widest border border-terminal-border text-terminal-text-dim hover:text-terminal-text hover:border-terminal-text-dim transition-colors"
    >{children}</button>
  )
}
function Done({ children }) {
  return <div className="text-xs text-terminal-green flex items-center gap-2"><span aria-hidden="true">✓</span>{children}</div>
}

export default function SetupWizard({ onComplete }) {
  const { watchlist, addToWatchlist, addAlert, setChatOpen, setActiveModule, chatMessages, chatOpen } = useStore()
  const [step, setStep] = useState(1)
  const [did, setDid] = useState({})        // what the user actually did, for the summary
  const next = () => setStep((s) => Math.min(TOTAL, s + 1))
  const record = (k, v) => setDid((d) => ({ ...d, [k]: v }))

  // ── Step 1 state
  const [query, setQuery] = useState('BHP.AX')
  const [picked, setPicked] = useState('BHP.AX')
  const matches = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return []
    return UNIVERSE.filter((u) => u.sym.startsWith(q) || u.sym.replace('.AX', '') === q || u.name.toUpperCase().includes(q)).slice(0, 6)
  }, [query])
  const onWatchlist = (sym) => watchlist.includes(sym)
  const addStock = (sym) => {
    addToWatchlist(sym)
    setDid((d) => ({ ...d, watchlist: [...(d.watchlist ?? []), sym] }))
  }

  // ── Step 2
  const [wantsPortfolio, setWantsPortfolio] = useState(null)

  // ── Step 3: watch the real conversation for the answer (or the failure)
  const [aiSentAt, setAiSentAt] = useState(null)
  const aiReply = aiSentAt != null ? chatMessages.at(-1) : null
  const aiState = !aiSentAt ? 'idle'
    : !aiReply || aiReply.role !== 'assistant' || !aiReply.content ? 'waiting'
    : /^\[(ERROR|LIMIT REACHED)\]/.test(aiReply.content) ? 'error' : 'answered'
  const sendAi = () => {
    window.dispatchEvent(new CustomEvent('madden:ask-ai', { detail: { prompt: AI_PROMPT, visible: true } }))
    setAiSentAt(Date.now())
    record('ai', true)
  }
  useEffect(() => { if (step === 3) setChatOpen(true) }, [step, setChatOpen])

  // ── Step 4: alert on something they now watch
  const alertChoices = useMemo(() => {
    const eq = watchlist.filter((s) => s.endsWith('.AX') || MOCK_US_STOCKS[s])
    return eq.length ? eq.slice(0, 8) : ['BHP.AX']
  }, [watchlist])
  const [alertSym, setAlertSym] = useState(null)
  const sym4 = alertSym ?? (did.watchlist?.[0] && alertChoices.includes(did.watchlist[0]) ? did.watchlist[0] : alertChoices[0])
  const [direction, setDirection] = useState('above')
  const [price, setPrice] = useState('')
  const [lastPrice, setLastPrice] = useState(null)
  const priceTouched = useRef(false)
  useEffect(() => {
    if (step !== 4 || !sym4) return
    let live = true
    fetchEquityQuotes([sym4]).then((r) => {
      const q = r?.data?.[sym4]
      const last = q?.last ?? q?.price
      if (!live || !Number.isFinite(last)) return
      setLastPrice(last)
      if (!priceTouched.current) setPrice((last * (direction === 'above' ? 1.05 : 0.95)).toFixed(2))
    }).catch(() => {})
    return () => { live = false }
  }, [step, sym4, direction])
  const setAlert = () => {
    const v = parseFloat(price)
    if (!Number.isFinite(v) || v <= 0) return
    if (!addAlert(sym4, v, direction)) return
    record('alert', `${sym4.replace('.AX', '')} ${direction} ${fmtAud(v)}`)
  }

  const finish = () => {
    setChatOpen(false)
    if (wantsPortfolio) {
      // PortfolioModule opens its add form on mount when this is set.
      try { sessionStorage.setItem('maddex_open_add_holding', '1') } catch { /* private mode */ }
      setActiveModule('portfolio')
    } else {
      setActiveModule('dashboard')
    }
    onComplete()
  }

  // Spotlight target per step: the AI panel on step 3, the bell on step 4.
  const holeSelector = step === 3 && chatOpen ? '[data-tour="ai-panel"]' : step === 4 ? '[data-tour="bell"]' : null
  const hole = useRect(holeSelector)

  // Where the card sits: centred, or beside the thing it is pointing at.
  const cardPos = step === 3 && hole
    ? { position: 'fixed', top: '50%', left: Math.max(16, hole.left - 440 - 28), transform: 'translateY(-50%)' }
    : step === 4 && hole
      ? { position: 'fixed', top: hole.top + hole.height + 22, left: Math.max(16, hole.left + hole.width - 440) }
      : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div className="fixed inset-0 z-[200] font-mono" role="dialog" aria-modal="true" aria-label={`Setup, step ${step} of ${TOTAL}`}>
      <Scrim hole={hole} pad={step === 4 ? 4 : 2} />

      <div
        style={{ ...cardPos, width: 440, maxWidth: 'calc(100vw - 32px)', backgroundColor: '#0B1628',
          backgroundImage: 'linear-gradient(180deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0) 34%)',
          border: '1px solid rgba(201,168,76,0.4)', animation: 'maddex-welcome-in 300ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        className="shadow-2xl"
      >
        {/* Arrow from the card to the spotlit element */}
        {step === 4 && hole && (
          <span aria-hidden="true" className="absolute -top-[7px] w-3 h-3 rotate-45"
            style={{ right: Math.max(14, 440 - (hole.left + hole.width / 2 - (cardPos.left ?? 0)) - 6), background: '#0B1628', borderLeft: '1px solid rgba(201,168,76,0.4)', borderTop: '1px solid rgba(201,168,76,0.4)' }} />
        )}

        <div className="flex items-center justify-between px-6 pt-5">
          <span className="text-[9px] tracking-[0.22em] text-terminal-gold">SETUP · STEP {step} OF {TOTAL}</span>
          {step < TOTAL && (
            <button onClick={finish} className="text-[9px] tracking-[0.18em] text-terminal-text-dim hover:text-terminal-text">EXIT SETUP</button>
          )}
        </div>
        <div className="flex gap-1 px-6 mt-2" aria-hidden="true">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={i} className="h-[2px] flex-1 transition-colors" style={{ background: i < step ? '#C9A84C' : 'rgba(99,120,153,0.3)' }} />
          ))}
        </div>

        <div className="px-6 pt-5 pb-6">
          {step === 1 && (
            <>
              <h2 className="text-terminal-text-bright text-lg font-bold tracking-wide">Start your watchlist</h2>
              <p className="text-xs text-terminal-text-dim mt-1.5 leading-relaxed">
                Stocks you watch get live prices, news highlights and alerts across the terminal.
              </p>
              <div className="mt-4 flex items-center border border-terminal-border focus-within:border-terminal-gold bg-terminal-bg">
                <span className="px-2.5 text-terminal-gold text-xs" aria-hidden="true">⌕</span>
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPicked(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { setPicked(matches[0].sym); setQuery(matches[0].sym) } }}
                  placeholder="Search ticker or company — BHP, CSL, Apple…"
                  aria-label="Search for a stock"
                  className="flex-1 bg-transparent py-2 pr-2 text-xs text-terminal-text-bright outline-none uppercase placeholder:normal-case placeholder:text-terminal-text-dim/50"
                />
              </div>
              {matches.length > 0 && !(picked && matches.length === 1 && matches[0].sym === picked) && (
                <div className="border border-t-0 border-terminal-border max-h-40 overflow-y-auto">
                  {matches.map((m) => (
                    <button key={m.sym} onClick={() => { setPicked(m.sym); setQuery(m.sym) }}
                      className={`w-full flex items-center gap-3 px-3 py-1.5 text-left text-xs hover:bg-terminal-gold/10 ${picked === m.sym ? 'bg-terminal-gold/10' : ''}`}>
                      <span className="w-16 font-bold text-terminal-text-bright">{m.sym}</span>
                      <span className="flex-1 truncate text-terminal-text-dim">{m.name}</span>
                      <span className="text-[9px] text-terminal-text-dim/60">{onWatchlist(m.sym) ? '✓ WATCHING' : m.ex}</span>
                    </button>
                  ))}
                </div>
              )}
              {picked && (
                <div className="mt-3">
                  {onWatchlist(picked)
                    ? <Done>{picked} is on your watchlist</Done>
                    : <Primary onClick={() => addStock(picked)}>+ ADD {picked} TO WATCHLIST</Primary>}
                </div>
              )}
              <div className="mt-4">
                <div className="text-[9px] tracking-[0.18em] text-terminal-text-dim/70 mb-1.5">POPULAR</div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED.map((s) => (
                    <button key={s} onClick={() => (onWatchlist(s) ? null : addStock(s))} disabled={onWatchlist(s)}
                      className={`px-2 py-1 text-[10px] border transition-colors ${onWatchlist(s)
                        ? 'border-terminal-green/40 text-terminal-green/80 cursor-default'
                        : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'}`}
                    >{onWatchlist(s) ? '✓ ' : '+ '}{s}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between mt-6">
                <button onClick={next} className="text-[10px] tracking-[0.18em] text-terminal-text-dim hover:text-terminal-text">SKIP</button>
                <Primary onClick={next}>CONTINUE →</Primary>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-terminal-text-bright text-lg font-bold tracking-wide">Do you hold any shares?</h2>
              <p className="text-xs text-terminal-text-dim mt-1.5 leading-relaxed">
                Add what you own and Maddex tracks your P&amp;L, sector exposure and dividend income — and MaddenAI can
                answer questions about your actual portfolio.
              </p>
              <div className="flex flex-col gap-2 mt-5">
                <Primary onClick={() => { setWantsPortfolio(true); record('portfolio', 'open'); next() }}>YES — ADD HOLDINGS</Primary>
                <Secondary onClick={() => { setWantsPortfolio(false); next() }}>NOT YET — SHOW ME AROUND</Secondary>
              </div>
              <p className="text-[10px] text-terminal-text-dim/60 mt-3 leading-relaxed">
                Choosing yes opens the add-holding form when setup finishes. You can also import a broker CSV there.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-terminal-text-bright text-lg font-bold tracking-wide">Ask MaddenAI</h2>
              <p className="text-xs text-terminal-text-dim mt-1.5 leading-relaxed">
                Your analyst, built into every screen. It reasons over the figures the terminal gives it — it does not make numbers up.
              </p>
              <div className="mt-4 border border-terminal-gold/30 bg-terminal-gold/5 px-3 py-2.5 text-xs text-terminal-text-bright leading-relaxed">
                {AI_PROMPT}
              </div>
              {aiState === 'idle' && (
                <div className="mt-3"><Primary onClick={sendAi}>SEND THIS →</Primary></div>
              )}
              {aiState === 'waiting' && (
                <div className="mt-3 text-xs text-terminal-gold animate-pulse">MaddenAI is answering in the panel →</div>
              )}
              {aiState === 'answered' && (
                <div className="mt-3"><Done>Answered — read it in the panel. Press <b className="text-terminal-gold">A</b> to open MaddenAI from anywhere.</Done></div>
              )}
              {aiState === 'error' && (
                <div className="mt-3 border border-terminal-border px-3 py-2 text-xs text-terminal-text-dim leading-relaxed">
                  MaddenAI isn't available right now{/credit/i.test(aiReply?.content ?? '') ? ' — the AI service needs credits topped up' : ''}.
                  Everything else in the terminal works; try it later with <b className="text-terminal-gold">A</b>.
                </div>
              )}
              <div className="flex items-center justify-between mt-6">
                <button onClick={next} className="text-[10px] tracking-[0.18em] text-terminal-text-dim hover:text-terminal-text">SKIP</button>
                <Primary onClick={next} disabled={aiState === 'waiting'}>CONTINUE →</Primary>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-terminal-text-bright text-lg font-bold tracking-wide">Set a price alert</h2>
              <p className="text-xs text-terminal-text-dim mt-1.5 leading-relaxed">
                Alerts live under the bell. Maddex checks prices in the background and tells you — on screen, or as a
                desktop notification when the tab is hidden.
              </p>
              {did.alert ? (
                <div className="mt-4"><Done>Alert set: {did.alert}. You'll find it under the bell.</Done></div>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                    <select value={sym4} onChange={(e) => { setAlertSym(e.target.value); priceTouched.current = false }}
                      aria-label="Stock" className="bg-terminal-bg border border-terminal-border text-xs text-terminal-text-bright px-2 py-2 outline-none focus:border-terminal-gold">
                      {alertChoices.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="flex border border-terminal-border" role="radiogroup" aria-label="Direction">
                      {['above', 'below'].map((d) => (
                        <button key={d} role="radio" aria-checked={direction === d}
                          onClick={() => { setDirection(d); priceTouched.current = false }}
                          className={`px-2.5 py-2 text-[10px] font-bold tracking-wider ${direction === d ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
                        >{d.toUpperCase()}</button>
                      ))}
                    </div>
                    <div className="flex items-center border border-terminal-border focus-within:border-terminal-gold">
                      <span className="pl-2 text-xs text-terminal-text-dim">A$</span>
                      <input value={price} onChange={(e) => { priceTouched.current = true; setPrice(e.target.value) }}
                        inputMode="decimal" aria-label="Alert price"
                        className="w-full bg-transparent px-1.5 py-2 text-xs text-terminal-text-bright outline-none tabular-nums" />
                    </div>
                  </div>
                  {lastPrice != null && (
                    <div className="text-[10px] text-terminal-text-dim mt-1.5">
                      Last {fmtAud(lastPrice)}{USING_MOCK_DATA ? ' · demo data until a live feed is connected' : ''}
                    </div>
                  )}
                  <div className="mt-3"><Primary onClick={setAlert} disabled={!(parseFloat(price) > 0)}>SET ALERT</Primary></div>
                </>
              )}
              <div className="flex items-center justify-between mt-6">
                <button onClick={next} className="text-[10px] tracking-[0.18em] text-terminal-text-dim hover:text-terminal-text">SKIP</button>
                <Primary onClick={next}>CONTINUE →</Primary>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="text-terminal-text-bright text-lg font-bold tracking-wide">Your terminal is ready.</h2>
              <ul className="mt-4 space-y-2 text-xs">
                {[
                  [did.watchlist?.length, did.watchlist?.length ? `Watching ${did.watchlist.join(', ')}` : 'Watchlist — using the starter list'],
                  [did.portfolio, did.portfolio ? 'Portfolio — the add-holding form opens next' : 'Portfolio — add holdings any time'],
                  [did.ai, did.ai ? 'Asked MaddenAI about the ASX' : 'MaddenAI — press A any time'],
                  [did.alert, did.alert ? `Alert: ${did.alert}` : 'Alerts — set one from ⚡ on any watchlist row'],
                ].map(([ok, label]) => (
                  <li key={label} className="flex items-start gap-2.5">
                    <span className={ok ? 'text-terminal-green' : 'text-terminal-text-dim/40'} aria-hidden="true">{ok ? '✓' : '○'}</span>
                    <span className={ok ? 'text-terminal-text-bright' : 'text-terminal-text-dim'}>{label}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-terminal-border/50 pt-4 grid grid-cols-3 gap-2 text-center">
                {[['/', 'Command bar'], ['A', 'MaddenAI'], ['?', 'All shortcuts']].map(([k, l]) => (
                  <div key={k}>
                    <kbd className="inline-block min-w-[26px] px-1.5 py-0.5 border border-terminal-gold/40 text-terminal-gold text-xs">{k}</kbd>
                    <div className="text-[9px] text-terminal-text-dim mt-1 tracking-wider">{l.toUpperCase()}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6"><Primary onClick={finish}>ENTER TERMINAL →</Primary></div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
