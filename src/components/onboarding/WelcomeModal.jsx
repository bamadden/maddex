
// The first thing anyone sees.
//
// Shown once per browser, before sign-in, so it can do the job a landing page
// does: say what this is and why it is worth two minutes. The existing setup
// flow runs after an account exists, which is too late to answer "should I
// make one".
//
// Claims here are deliberately checkable against what the terminal actually
// does today. "Real-time ASX" would be a lie while equities are DEMO, so the
// live line names the feeds that are genuinely live and the equities line says
// what it is.

const FEATURES = [
  {
    glyph: '◪',
    title: 'Markets, live and labelled',
    body: 'Crypto, FX, commodities and global indices from live feeds. Equity prices run on demo data until a provider is connected — and every one of them says so.',
  },
  {
    glyph: '▲',
    title: 'MaddenAI, for analysis not arithmetic',
    body: 'Ask about a stock, the macro picture, or your own portfolio. The model writes the reasoning; every figure it quotes is one the terminal handed it.',
  },
  {
    glyph: '⬡',
    title: 'Global intelligence',
    body: 'Shipping chokepoints, trade flows, geopolitical risk scored against a published rubric, and a live intel map.',
  },
]

export default function WelcomeModal({ onGetStarted, onSignIn }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 font-mono"
      style={{
        // Vignette rather than a flat scrim: the corners fall away and the
        // card sits in the light, which is what makes a modal feel placed
        // rather than layered.
        background: 'radial-gradient(ellipse at center, rgba(6,13,26,0.94) 0%, rgba(0,0,0,0.98) 100%)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Maddex"
    >
      <div
        className="w-full border shadow-2xl"
        style={{
          maxWidth: 560,
          borderColor: 'rgba(201,168,76,0.35)',
          // backgroundColor and backgroundImage set SEPARATELY, and the colour
          // is a literal.
          //
          // The shorthand `background: linear-gradient(...), rgb(var(--t-panel))`
          // rendered the card fully transparent — the terminal read straight
          // through the welcome screen. A theme variable resolves to a bare
          // triplet ("11 22 40") which only works inside the alpha-slash form
          // Tailwind generates; in a hand-written shorthand it silently
          // invalidates the whole declaration, taking the gradient with it.
          // This is also the one surface that must render before any theme is
          // applied, so a literal is correct here regardless.
          backgroundColor: '#0B1628',
          backgroundImage: 'linear-gradient(180deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0) 32%)',
          // THE ENTRANCE NEVER GATES VISIBILITY.
          //
          // This first rendered with opacity animating 0 -> 1 on mount. Chrome
          // freezes CSS transitions in a hidden tab, so the card sat
          // permanently at opacity 0.197 — the terminal read straight through
          // the welcome screen — until the tab was focused. Opening the app in
          // a background tab is ordinary (a restored session, a cmd-clicked
          // link), and a blocking modal that is invisible until focus is a bad
          // failure for the one screen a new user must see.
          //
          // So the card is opaque from the first paint and only the transform
          // animates. A frozen or disabled animation now degrades to "no
          // motion", which is correct, rather than to "not there".
          animation: 'maddex-welcome-in 340ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div className="px-8 pt-8 pb-6 text-center border-b border-terminal-border/40">
          <div
            className="mx-auto flex items-center justify-center border"
            style={{ width: 48, height: 48, borderColor: 'rgba(201,168,76,0.5)', color: '#C9A84C', fontSize: 22 }}
          >▲</div>
          <div className="text-terminal-gold font-bold tracking-[0.3em] mt-4" style={{ fontSize: 15 }}>
            WELCOME TO MADDEX
          </div>
          <div className="text-2xs text-terminal-text-dim mt-1.5">
            Financial intelligence for Australian investors.
          </div>
        </div>

        <div className="px-8 py-6 space-y-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-3.5">
              <span
                className="flex-shrink-0 flex items-center justify-center border"
                style={{ width: 28, height: 28, borderColor: 'rgba(201,168,76,0.28)', color: '#C9A84C', fontSize: 13 }}
              >{f.glyph}</span>
              <div className="min-w-0">
                <div className="text-2xs font-bold text-terminal-text-bright">{f.title}</div>
                <div className="text-2xs text-terminal-text-dim leading-relaxed mt-0.5">{f.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-8 pb-7">
          <button
            onClick={onGetStarted}
            className="w-full py-2.5 font-bold tracking-widest text-terminal-bg transition-colors"
            style={{ fontSize: 12, background: '#C9A84C' }}
          >GET STARTED →</button>
          <div className="text-2xs text-terminal-text-dim/60 text-center mt-2">
            Takes about two minutes to set up.
          </div>

          {onSignIn && (
            <div className="text-2xs text-terminal-text-dim/70 text-center mt-4 pt-4 border-t border-terminal-border/30">
              Already have an account?{' '}
              <button onClick={onSignIn} className="text-terminal-gold hover:underline">Sign in</button>
            </div>
          )}
        </div>

        <div className="px-8 pb-5">
          <div className="text-2xs text-terminal-text-dim/40 text-center leading-relaxed">
            General information only. Nothing in Maddex is financial advice or a personal recommendation.
          </div>
        </div>
      </div>
    </div>
  )
}
