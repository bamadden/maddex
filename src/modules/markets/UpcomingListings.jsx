import { ASX_LISTINGS, CORPORATE_ACTIONS_AS_OF, listingStatus } from '../../data/corporateActions'
import { dispatchAskAI } from '../../utils/askAI'

// UPCOMING LISTINGS — the ASX's own upcoming floats page, as read on the date
// shown. A passed proposed date reads DATE PASSED, not LISTED: whether the
// float completed is something to check, not assume.

const STATUS_TONE = { UPCOMING: '#C9A84C', 'DATE PASSED': '#637899', TBA: '#637899' }
const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : 'TBA')
const fmtRaise = (n) => `A$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M`

export default function UpcomingListings() {
  const rows = [...ASX_LISTINGS].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
  return (
    <div className="flex-shrink-0 border-b border-terminal-border">
      <div className="panel-header flex items-center gap-2 flex-wrap">
        <span className="text-terminal-gold">UPCOMING LISTINGS</span>
        <span className="text-[9px] font-bold px-1.5 border border-terminal-gold/50 text-terminal-gold">INDICATIVE</span>
        <span className="text-2xs text-terminal-text-dim font-normal normal-case">
          ASX upcoming floats page, read {fmtDate(CORPORATE_ACTIONS_AS_OF)} ·{' '}
          <a href={rows[0]?.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-terminal-gold/80 hover:underline">asx.com.au ↗</a>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="terminal-table w-full text-2xs">
          <thead>
            <tr>
              <th className="text-left">CODE</th><th className="text-left">COMPANY</th><th className="text-left">SECTOR</th>
              <th className="text-right">EXPECTED</th><th className="text-right">RAISING</th><th className="text-right">OFFER</th>
              <th className="text-left">STATUS</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const status = listingStatus(l)
              return (
                <tr key={l.code}>
                  <td className="font-mono font-bold text-terminal-text-bright">{l.code}</td>
                  <td className="text-terminal-text">{l.company}</td>
                  <td className="text-terminal-text-dim">{l.sector ?? '—'}</td>
                  <td className="text-right tabular-nums">{fmtDate(l.date)}</td>
                  <td className="text-right tabular-nums">{fmtRaise(l.raiseAud)}</td>
                  <td className="text-right tabular-nums">A${l.price.toFixed(2)}</td>
                  <td className="font-bold" style={{ color: STATUS_TONE[status] }}>{status}</td>
                  <td className="text-right">
                    <button
                      onClick={() => dispatchAskAI({
                        name: l.company, ticker: `${l.code}.AX`, date: l.date,
                        instruction: `${l.company} (proposed ASX code ${l.code}) intends to list on the ASX${l.date ? ` on ${l.date}` : ''}, raising ${fmtRaise(l.raiseAud)} at A$${l.price.toFixed(2)} a share (${l.note.toLowerCase()}). What should an investor weigh when looking at a small-cap IPO like this, and what should they read in the prospectus? General information only.`,
                      }, { rawPrompt: true })}
                      className="text-[9px] font-bold text-terminal-gold hover:underline"
                    >ASK MADDENAI</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1.5 text-2xs text-terminal-text-dim/70">
        New listings are high-risk investments. General information only. Dates and terms are the issuer&apos;s and can change — read the prospectus.
      </div>
    </div>
  )
}
