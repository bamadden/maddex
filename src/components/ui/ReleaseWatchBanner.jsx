import { useReleaseWatch } from '../../hooks/useReleaseWatch'
import { dismissRelease } from '../../services/releaseWatch'
import { runOfficialCheck } from '../../services/officialStats'
import { sydneyTzAbbr } from '../../utils/dateUtils'

// "DATA NOW RELEASED" — shown in Macro, Calendar, Dashboard and Rates once a
// high-impact release time has passed and verifiedConstants does not yet
// carry it. See services/releaseWatch.js.
//
// Two audiences. A reader is told the release is out, where to read it, and
// what the agency's API already shows. The maintainer (dev builds) also gets
// the instruction to update verifiedConstants and a button that opens the
// official feed check, which names each figure to change. Telling a paying
// reader to "update verifiedConstants" would be telling them about our source
// tree.

const MAINTAINER = import.meta.env.DEV

const fmt = (v) => (v == null ? '—' : `${Number(v).toFixed(1)}%`)

function openUpdateFlow() {
  runOfficialCheck({ force: true }).catch(() => { /* panel shows unavailable */ })
  window.dispatchEvent(new CustomEvent('madden:open-settings', { detail: { section: 'DATA SOURCES' } }))
}

export default function ReleaseWatchBanner({ compact = false, className = '' }) {
  const released = useReleaseWatch()
  if (!released.length) return null

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {released.map((e) => {
        const time = `${e.time} ${sydneyTzAbbr(e.date)}`
        const detected = e.newData.length > 0
        return (
          <div
            key={e.key}
            role="status"
            className="px-3 py-2 font-mono"
            style={{ border: '1px solid rgba(201,168,76,0.55)', background: 'rgba(201,168,76,0.10)' }}
          >
            <div className="flex items-start gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-bold tracking-widest text-terminal-gold" style={{ fontSize: compact ? 9 : 11 }}>
                  📊 {e.event.toUpperCase()} — DATA NOW RELEASED
                </div>
                <div className="text-terminal-text-dim mt-0.5" style={{ fontSize: compact ? 8 : 10 }}>
                  Released {time}. Official figures: {e.sourceLabel?.toLowerCase()}.
                  {MAINTAINER && ' Update verifiedConstants once confirmed.'}
                  {!MAINTAINER && !detected && ' Terminal figures update once the release is verified.'}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={e.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="font-bold tracking-widest border border-terminal-gold/50 text-terminal-gold px-2 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
                  style={{ fontSize: 9 }}
                >VIEW ON {e.sourceLabel} ↗</a>
                {MAINTAINER && (
                  <button
                    onClick={openUpdateFlow}
                    className="font-bold tracking-widest border border-terminal-border text-terminal-text-bright px-2 py-0.5 hover:border-terminal-gold transition-colors"
                    style={{ fontSize: 9 }}
                  >UPDATE NOW</button>
                )}
                <button
                  onClick={() => dismissRelease(e.key)}
                  aria-label="Dismiss"
                  className="text-terminal-text-dim hover:text-terminal-gold px-1"
                  style={{ fontSize: 11 }}
                >✕</button>
              </div>
            </div>

            {detected ? (
              <div className="mt-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(201,168,76,0.25)' }}>
                <div className="font-bold tracking-widest" style={{ fontSize: 9, color: '#2D8A50' }}>● NEW DATA DETECTED · ABS / RBA / FRED API</div>
                {e.newData.map((d) => (
                  <div key={d.label} className="text-terminal-text-bright mt-0.5" style={{ fontSize: compact ? 9 : 10 }}>
                    {d.label}: official API shows <b className="text-terminal-gold">{fmt(d.official)}</b> ({d.officialPeriod})
                    <span className="text-terminal-text-dim"> — terminal shows {fmt(d.terminal)} ({d.terminalPeriod})</span>
                  </div>
                ))}
                {MAINTAINER && (
                  <button
                    onClick={openUpdateFlow}
                    className="mt-1 font-bold tracking-widest text-terminal-gold underline"
                    style={{ fontSize: 9 }}
                  >UPDATE CONSTANTS →</button>
                )}
              </div>
            ) : (
              !compact && e.polling && (
                <div className="text-terminal-text-dim/60 mt-1" style={{ fontSize: 8 }}>
                  Checking the agency API every ten minutes for the new figures.
                </div>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
