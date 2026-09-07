import { LEGAL_DOCS, COMPANY, CONTACT, EFFECTIVE } from '../data/legalDocs'


// ─── Shell ───────────────────────────────────────────────────────────────────

const NAV = [
  ['/terms', 'Terms'],
  ['/privacy', 'Privacy'],
  ['/disclaimer', 'Disclaimer'],
]

export default function LegalPage({ slug }) {
  const doc = LEGAL_DOCS[slug]
  if (!doc) return null

  return (
    <div className="h-screen overflow-y-auto bg-terminal-bg text-terminal-text font-mono flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <a href="/" className="flex items-center gap-2 mb-8 w-fit group">
          <span className="text-terminal-gold text-xl">▲</span>
          <span className="text-terminal-gold font-bold tracking-widest group-hover:text-terminal-gold-bright transition-colors">MADDEX</span>
        </a>

        <h1 className="text-2xl font-bold text-terminal-text-bright tracking-wide">{doc.title}</h1>
        <p className="text-2xs text-terminal-text-dim mt-1">
          {COMPANY} · Effective {EFFECTIVE}
        </p>
        <p className="text-xs text-terminal-text leading-relaxed mt-4 pb-5 border-b border-terminal-border">
          {doc.lede}
        </p>

        <div className="mt-6 space-y-6">
          {doc.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-2xs font-bold text-terminal-gold tracking-widest uppercase mb-2">{s.heading}</h2>
              <div className="space-y-2.5">
                {s.body.map((p, i) => (
                  <p key={i} className="text-xs text-terminal-text-dim leading-relaxed">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 pt-5 border-t border-terminal-border flex flex-wrap items-center gap-x-4 gap-y-2">
          {NAV.filter(([href]) => href !== `/${slug}`).map(([href, label]) => (
            <a key={href} href={href} className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors">
              {label} →
            </a>
          ))}
          <a href={`mailto:${CONTACT}`} className="text-2xs text-terminal-text-dim hover:text-terminal-gold transition-colors">
            {CONTACT}
          </a>
          <span className="flex-1" />
          <a href="/" className="text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-4 py-1.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors">
            RETURN TO TERMINAL
          </a>
        </div>
      </div>
    </div>
  )
}
