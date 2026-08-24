import { useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore'

const TOTAL_STEPS = 6 // welcome, nav, markets, ai, command bar, complete

function ProgressDots({ active }) {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${i === active ? 'bg-terminal-gold' : 'bg-terminal-border'}`}
        />
      ))}
    </div>
  )
}

function NextBtn({ label = 'NEXT →', onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-2xs font-bold text-terminal-gold border border-terminal-gold/50 py-2 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
    >{label}</button>
  )
}

function SkipButton({ onSkip }) {
  return (
    <button
      onClick={onSkip}
      className="absolute top-3 right-3 text-2xs text-terminal-text-dim hover:text-terminal-text tracking-widest z-10"
    >SKIP</button>
  )
}

// Centered modal used for the WELCOME and COMPLETE steps — the only two that
// aren't "point at a piece of the UI" steps.
function CenterModal({ children, dotIndex, onSkip }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-terminal-panel border border-terminal-gold/40 w-full max-w-md shadow-2xl font-mono p-8 text-center">
        <SkipButton onSkip={onSkip} />
        {children}
        <div className="mt-6"><ProgressDots active={dotIndex} /></div>
      </div>
    </div>
  )
}

// Finds `[data-tour="selector"]` in the DOM and tracks its bounding rect
// (recomputed on resize/scroll) so the callout can follow it — no dimming
// overlay, just a gold pulsing border box over the real element plus a
// nearby tooltip, per the brief's own "highlight X with a gold pulsing
// border" wording rather than a full spotlight-cutout treatment.
function useTourTarget(selector) {
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    let scrolled = false
    const measure = () => {
      const el = document.querySelector(`[data-tour="${selector}"]`)
      if (el && !scrolled) {
        // The target may be off-screen (e.g. below the fold in a scrollable
        // module) — bring it into view once before measuring so the
        // highlight box lands somewhere the user can actually see.
        scrolled = true
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    const id = setInterval(measure, 300) // layout can shift as live data loads in / scroll settles
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { clearInterval(id); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [selector])
  return rect
}

function HighlightCallout({ selector, title, body, dotIndex, onSkip, children, calloutSide = 'right' }) {
  const rect = useTourTarget(selector)

  const boxStyle = rect
    ? { position: 'fixed', top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }
    : null

  const calloutStyle = rect
    ? calloutSide === 'right'
      ? { position: 'fixed', top: Math.max(16, Math.min(window.innerHeight - 260, rect.top)), left: Math.min(window.innerWidth - 340, rect.right + 16) }
      : { position: 'fixed', top: Math.max(16, Math.min(window.innerHeight - 260, rect.bottom + 12)), left: Math.max(16, Math.min(window.innerWidth - 340, rect.left)) }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div className="fixed inset-0 z-[200]">
      <SkipButton onSkip={onSkip} />
      {boxStyle && (
        <div
          style={boxStyle}
          className="pointer-events-none border-2 border-terminal-gold pulse-gold"
        />
      )}
      <div style={{ ...calloutStyle, width: 320 }} className="bg-terminal-panel border border-terminal-gold/40 shadow-2xl font-mono p-4">
        <div className="text-terminal-gold font-bold text-2xs tracking-widest mb-2">{title}</div>
        <div className="text-2xs text-terminal-text leading-relaxed mb-4">{body}</div>
        {children}
        <div className="mt-4"><ProgressDots active={dotIndex} /></div>
      </div>
    </div>
  )
}

// Self-contained visual demo of the command bar — types "BHP" character by
// character and shows a mock result, rather than puppeting the real
// CommandBar's internal input state from the outside (that component
// already owns a lot of complex state; a look-alike demo is far lower risk
// than reaching into it).
function CommandBarDemo() {
  const [typed, setTyped] = useState('')
  const full = 'BHP'
  useEffect(() => {
    document.querySelector('.cmd-input')?.focus()
    let i = 0
    const id = setInterval(() => {
      i += 1
      setTyped(full.slice(0, i))
      if (i >= full.length) clearInterval(id)
    }, 350)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="mt-1 mb-3 border border-terminal-border bg-terminal-bg">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-terminal-border">
        <span className="text-terminal-gold text-2xs font-bold">CMD&gt;</span>
        <span className="text-2xs text-terminal-text-bright">{typed}<span className="cursor-blink">|</span></span>
      </div>
      {typed === full && (
        <div className="px-2 py-1.5 text-2xs text-terminal-text-dim">
          <span className="text-terminal-text-bright font-bold">BHP.AX</span> · BHP Group · ASX
        </div>
      )}
    </div>
  )
}

export default function OnboardingFlow({ onComplete }) {
  const { setActiveModule, setChatOpen } = useStore()
  const [step, setStep] = useState(0)
  const [marketsPhase, setMarketsPhase] = useState('indices') // indices | heatmap

  useEffect(() => {
    if (step === 2) setActiveModule('markets')
    if (step === 3) setChatOpen(true)
  }, [step, setActiveModule, setChatOpen])

  const next = useCallback(() => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)), [])

  const sendAndSee = () => {
    window.dispatchEvent(new CustomEvent('madden:ask-ai', {
      detail: { prompt: 'Tell me about the ASX today', context: null, fullscreen: false },
    }))
    next()
  }

  const finish = (targetModule) => {
    if (targetModule) setActiveModule(targetModule)
    onComplete()
  }

  if (step === 0) {
    return (
      <CenterModal dotIndex={0} onSkip={onComplete}>
        <div className="text-terminal-gold text-3xl mb-3">▲</div>
        <div className="text-2xl font-bold text-terminal-text-bright mb-2">Welcome to Maddex.</div>
        <div className="text-2xs text-terminal-text-dim mb-6 leading-relaxed">
          The financial intelligence terminal built for everyday investors.
          Let me show you around.
        </div>
        <NextBtn label="GET STARTED" onClick={next} />
      </CenterModal>
    )
  }

  if (step === 1) {
    return (
      <HighlightCallout
        selector="nav-sidebar"
        title="NAVIGATION"
        body="These modules give you complete market coverage — markets, crypto, rates, macro, watchlist, portfolio, news, global, and more. Press F1–F8 to switch instantly between the core ones."
        dotIndex={1}
        onSkip={onComplete}
      >
        <NextBtn onClick={next} />
      </HighlightCallout>
    )
  }

  if (step === 2) {
    return marketsPhase === 'indices' ? (
      <HighlightCallout
        selector="index-bar"
        title="MARKETS MODULE"
        body="These indices update in real time. Click any to explore that market."
        dotIndex={2}
        onSkip={onComplete}
        calloutSide="bottom"
      >
        <NextBtn onClick={() => setMarketsPhase('heatmap')} />
      </HighlightCallout>
    ) : (
      <HighlightCallout
        selector="sector-heatmap"
        title="MARKETS MODULE"
        body="The heatmap shows sector performance at a glance."
        dotIndex={2}
        onSkip={onComplete}
        calloutSide="bottom"
      >
        <NextBtn onClick={next} />
      </HighlightCallout>
    )
  }

  if (step === 3) {
    return (
      <HighlightCallout
        selector="ai-panel"
        title="MADDENAI"
        body={<>MaddenAI is your personal analyst. Ask anything about any stock, crypto, FX, or macro. Try: <span className="text-terminal-gold">"Tell me about the ASX today"</span></>}
        dotIndex={3}
        onSkip={onComplete}
        calloutSide="bottom"
      >
        <NextBtn label="SEND AND SEE →" onClick={sendAndSee} />
      </HighlightCallout>
    )
  }

  if (step === 4) {
    return (
      <HighlightCallout
        selector="cmd-bar"
        title="COMMAND BAR"
        body="The command bar is the fastest way to navigate. Type any ticker, command, or question."
        dotIndex={4}
        onSkip={onComplete}
        calloutSide="bottom"
      >
        <CommandBarDemo />
        <NextBtn label="DONE" onClick={next} />
      </HighlightCallout>
    )
  }

  return (
    <CenterModal dotIndex={5} onSkip={onComplete}>
      <div className="text-terminal-gold text-3xl mb-3">▲</div>
      <div className="text-2xl font-bold text-terminal-text-bright mb-2">You're all set.</div>
      <div className="text-2xs text-terminal-text-dim mb-6 leading-relaxed">
        Explore the terminal, or start with your watchlist.
      </div>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => finish('watchlist')}
          className="w-full text-2xs font-bold text-terminal-gold border border-terminal-gold/50 py-2 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
        >ADD STOCKS TO WATCHLIST</button>
        <button
          onClick={() => finish(null)}
          className="w-full text-2xs text-terminal-text-dim border border-terminal-border py-2 hover:text-terminal-text transition-colors"
        >EXPLORE THE TERMINAL</button>
      </div>
    </CenterModal>
  )
}
