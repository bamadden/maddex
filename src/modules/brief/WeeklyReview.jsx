import { useState } from 'react'
import { SkeletonText } from '../../components/ui/Skeleton'
import { generateWeeklyReview, getCachedWeeklyReview, reviewWeek } from '../../services/weeklyReviewService'
import { sydneyTzAbbr } from '../../utils/dateUtils'
import { BriefSection } from './BriefParts'

// ─── Weekly review ─────────────────────────────────────────────────────────
//
// The body renders one stored review; the tab owns loading and generation.
// Split so the weekend state can lead with the same body without taking on
// the tab's empty and error states.

const fmtStamp = (iso) => {
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' })
  const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Sydney' })
  return `${day}, ${time} ${sydneyTzAbbr(d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }))}`
}

const REGEN_BTN = 'font-mono text-[9px] tracking-widest px-2 py-1 rounded-sm text-terminal-text-dim hover:text-terminal-gold transition-colors disabled:opacity-40'

export function WeeklyReviewBody({ review, kicker = 'WEEK IN REVIEW', onRegenerate, busy = false }) {
  return (
    <div>
      <header className="pt-6 pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-terminal-gold uppercase" style={{ fontSize: 9, letterSpacing: '0.28em' }}>{kicker}</div>
          <h1 className="font-mono font-bold text-terminal-text-bright mt-1.5" style={{ fontSize: 24, letterSpacing: '0.04em' }}>{review.label}</h1>
        </div>
        <div className="flex items-center gap-2 font-mono" style={{ fontSize: 10 }}>
          <span className="px-1.5 py-0.5 text-terminal-gold font-bold tracking-widest" style={{ fontSize: 8, border: '1px solid rgba(201,168,76,0.45)' }}>✦ MADDENAI</span>
          {review.generatedAt && <span className="text-terminal-text-dim">Generated {fmtStamp(review.generatedAt)}</span>}
        </div>
      </header>

      {review.headline && (
        <div className="font-sans text-terminal-text-bright font-semibold leading-snug mb-4" style={{ fontSize: 18 }}>{review.headline}</div>
      )}

      <div className="flex flex-col gap-3">
        {(review.sections ?? []).map((sec) => <BriefSection key={sec.title} title={sec.title} content={sec.content} />)}
      </div>

      <footer className="mt-6 pt-3 border-t border-terminal-border flex items-center justify-between gap-3 flex-wrap">
        <div className="font-mono text-terminal-text-dim/60" style={{ fontSize: 8, letterSpacing: '0.14em' }}>
          AI-GENERATED SUMMARY · FIGURES FROM VERIFIED AND LIVE DATA ONLY · EQUITY MOVES NOT COVERED (DEMO PRICES) · GENERAL INFORMATION · NOT ADVICE
        </div>
        {onRegenerate && (
          <button onClick={onRegenerate} disabled={busy} className={REGEN_BTN} style={{ border: '1px solid rgba(201,168,76,0.2)' }}>
            {busy ? 'GENERATING…' : '↻ REGENERATE'}
          </button>
        )}
      </footer>
    </div>
  )
}

export default function WeeklyReviewTab({ history }) {
  const [week] = useState(() => reviewWeek())
  const [review, setReview] = useState(() => getCachedWeeklyReview(week.key))
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [error, setError] = useState(null)

  const generate = async () => {
    setStatus('loading')
    setError(null)
    try {
      setReview(await generateWeeklyReview({ force: true }))
      setStatus('idle')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  const noCredit = /credit balance/i.test(error ?? '')

  return (
    <article className="max-w-[920px] mx-auto px-5 pb-8">
      {status === 'loading' && !review && (
        <div className="pt-6 space-y-5">
          <div className="text-2xs text-terminal-gold tracking-widest animate-pulse">WRITING THE REVIEW OF {week.label}…</div>
          <SkeletonText lines={4} />
          <SkeletonText lines={5} />
        </div>
      )}

      {review && <WeeklyReviewBody review={review} onRegenerate={generate} busy={status === 'loading'} />}

      {!review && status !== 'loading' && (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <span className="w-14 h-14 rounded-full border border-terminal-gold/40 text-terminal-gold flex items-center justify-center" style={{ fontSize: 24 }} aria-hidden="true">✦</span>
          <div className="text-terminal-text-bright text-base font-semibold tracking-wide mt-1">
            {status === 'error' ? (noCredit ? 'Review not generated' : 'Review unavailable') : `No review yet for ${week.label}`}
          </div>
          <div className="text-terminal-text-dim text-sm max-w-md leading-relaxed">
            {status === 'error'
              ? (noCredit ? 'Add Anthropic API credits to generate the weekly review.' : error)
              : 'The weekly review is written automatically after the Friday close, 4:30pm Sydney time, and stays up through the weekend. Or write this one now.'}
          </div>
          <button onClick={generate}
            className="mt-2 px-5 py-2 text-xs font-bold tracking-widest bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors">
            {status === 'error' ? 'RETRY' : 'GENERATE REVIEW NOW'}
          </button>
        </div>
      )}

      {review && status === 'error' && (
        <div className="mt-3 text-2xs text-terminal-red">{noCredit ? 'Regenerate failed: Anthropic API credits needed.' : `Regenerate failed: ${error}`}</div>
      )}

      {history && <div className="mt-6">{history}</div>}
    </article>
  )
}
