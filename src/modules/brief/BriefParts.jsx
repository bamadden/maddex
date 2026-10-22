import { clean } from './briefText'

// Section renderers shared by the daily brief and the weekly review.

// Line breaks become paragraphs, or list items where the line is a
// "Name — reason" pair.
export function SectionText({ text }) {
  const lines = clean(text).split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const isList = lines.length > 1 && lines.every((l) => / [—–-] /.test(l) || l.length < 160)
  if (isList) {
    return (
      <ul className="space-y-2">
        {lines.map((l, i) => {
          const m = l.match(/^(.{2,48}?)\s+[—–-]\s+(.+)$/)
          return (
            <li key={i} className="flex gap-2.5">
              <span className="text-terminal-gold flex-shrink-0 mt-[1px]">›</span>
              <span>{m ? <><b className="text-terminal-text-bright font-semibold">{m[1]}</b> — {m[2]}</> : l}</span>
            </li>
          )
        })}
      </ul>
    )
  }
  return <div className="space-y-2.5">{lines.map((l, i) => <p key={i}>{l}</p>)}</div>
}

export function BriefSection({ title, content }) {
  return (
    <section className="relative pl-5 py-4 pr-4" style={{ background: 'rgba(7,20,40,0.55)', border: '1px solid rgba(201,168,76,0.08)' }}>
      <span className="absolute left-0 top-0 bottom-0" style={{ width: 3, background: '#C9A84C' }} />
      <h3 className="font-mono text-terminal-gold uppercase mb-2" style={{ fontSize: 8, letterSpacing: '0.22em' }}>{title}</h3>
      <div className="font-sans text-terminal-text" style={{ fontSize: 14, lineHeight: 1.7 }}>
        <SectionText text={content} />
      </div>
    </section>
  )
}

