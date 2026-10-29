import { useEffect, useState } from 'react'
import { perfSummary, getErrorLog, clearErrorLog, clearPerfLog, DIAGNOSTICS_CHANGED } from '../../services/diagnostics'

// Settings → About → PERFORMANCE and ERROR LOG. Both read from this device's
// local log (services/diagnostics); nothing leaves the browser unless REPORT
// BUG is pressed, which opens the reader's own mail client with the log in
// the body to check before sending.

const REPORT_TO = 'ben@maddex.com.au'

export default function DiagnosticsPanel() {
  const [, bump] = useState(0)
  useEffect(() => {
    const on = () => bump((n) => n + 1)
    window.addEventListener(DIAGNOSTICS_CHANGED, on)
    return () => window.removeEventListener(DIAGNOSTICS_CHANGED, on)
  }, [])
  const p = perfSummary()
  const errors = getErrorLog()

  const report = () => {
    const body = [
      'Describe what you were doing when this happened:',
      '',
      '',
      '— Error log (most recent first) —',
      ...errors.slice(0, 15).map((e) => `${e.timestamp} [${e.module}]${e.count > 1 ? ` ×${e.count}` : ''} ${e.error}`),
      '',
      `Performance: avg module load ${p.moduleAvg ?? '—'}ms, slowest ${p.slowest ? `${p.slowest.label} ${p.slowest.ms}ms` : '—'}, avg API ${p.apiAvg ?? '—'}ms`,
      `Browser: ${navigator.userAgent}`,
    ].join('\n')
    window.location.href = `mailto:${REPORT_TO}?subject=${encodeURIComponent('Maddex bug report')}&body=${encodeURIComponent(body.slice(0, 1800))}`
  }

  const row = (label, value) => (
    <div className="flex items-baseline justify-between text-2xs py-0.5">
      <span className="text-terminal-text-dim">{label}</span>
      <span className="text-terminal-text-bright tabular-nums font-mono">{value}</span>
    </div>
  )

  return (
    <div className="pt-2 border-t border-terminal-border/30 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs text-terminal-text-bright">Performance</span>
          <span className="text-2xs text-terminal-text-dim/50">this device</span>
          <button onClick={clearPerfLog} className="ml-auto text-2xs text-terminal-text-dim hover:text-terminal-gold">RESET</button>
        </div>
        {row('Average module load', p.moduleAvg != null ? `${p.moduleAvg}ms (${p.moduleSamples} loads)` : 'no samples yet')}
        {row('Slowest module', p.slowest ? `${p.slowest.label} (${p.slowest.ms}ms)` : '—')}
        {row('API response time, avg', p.apiAvg != null ? `${p.apiAvg}ms (${p.apiSamples} requests)` : 'no samples yet')}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs text-terminal-text-bright">Error log</span>
          <span className="text-2xs text-terminal-text-dim/50">{errors.length ? `${errors.length} recent` : 'no errors recorded'}</span>
          {errors.length > 0 && (
            <>
              <button onClick={clearErrorLog} className="ml-auto text-2xs text-terminal-text-dim hover:text-terminal-red">CLEAR LOG</button>
              <button onClick={report} className="text-2xs font-bold text-terminal-gold border border-terminal-gold/40 px-2 hover:bg-terminal-gold hover:text-terminal-bg">REPORT BUG</button>
            </>
          )}
        </div>
        {errors.length > 0 && (
          <div className="border border-terminal-border max-h-48 overflow-y-auto divide-y divide-terminal-border/40">
            {errors.map((e, i) => (
              <div key={`${e.timestamp}-${i}`} className="px-2 py-1 text-2xs">
                <div className="flex gap-2 text-terminal-text-dim/70 font-mono" style={{ fontSize: 9 }}>
                  <span>{new Date(e.timestamp).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                  <span className="text-terminal-gold/80">{e.module}</span>
                  {e.count > 1 && <span>×{e.count}</span>}
                </div>
                <div className="text-terminal-text break-words">{e.error}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
