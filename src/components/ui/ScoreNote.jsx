import { useState } from 'react'
import { METHODS } from '../../data/methodology'
import { sydneyClock } from '../../utils/dateUtils'

// The line under every score card: what kind of number it is, that it is not
// a recommendation, what it was built from and when — with the method one
// click away (data/methodology.js).
//
//   method  — a key of METHODS
//   inputs  — optional [{ name, value }] actually used this time
//   asOf    — optional ms timestamp (or ISO date) of the data
export default function ScoreNote({ method, inputs, asOf, className = '' }) {
  const [open, setOpen] = useState(false)
  const m = METHODS[method]
  if (!m) return null
  const when = asOf == null ? null : typeof asOf === 'number' ? sydneyClock(asOf).text : asOf
  return (
    <div className={`font-mono text-terminal-text-dim ${className}`} style={{ fontSize: 11 }} data-score-note={method}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span>Descriptive measure</span>
        <span aria-hidden="true">·</span>
        <span className="text-terminal-text">Not a recommendation</span>
        {when && <><span aria-hidden="true">·</span><span>As at {when}</span></>}
        <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} aria-expanded={open}
          className="text-terminal-gold hover:underline underline-offset-2">
          {open ? 'Hide method' : 'How it\'s calculated ›'}
        </button>
      </div>
      {open && (
        <div className="mt-1.5 p-2 border border-terminal-border bg-terminal-bg/60 text-left font-sans normal-case tracking-normal" style={{ fontSize: 12 }} onClick={(e) => e.stopPropagation()}>
          <div className="font-semibold text-terminal-text-bright">{m.name}</div>
          <p className="mt-1 text-terminal-text">{m.what}</p>
          <ul className="mt-1 list-disc list-inside space-y-0.5">
            {m.how.map((h) => <li key={h}>{h}</li>)}
          </ul>
          {inputs?.length > 0 && (
            <div className="mt-1.5">
              <div className="font-mono text-terminal-text-dim" style={{ fontSize: 11 }}>INPUTS THIS TIME</div>
              <ul className="mt-0.5 space-y-0.5">
                {inputs.map((i) => <li key={i.name} className="flex justify-between gap-3"><span>{i.name}</span><span className="font-mono tabular-nums">{i.value}</span></li>)}
              </ul>
            </div>
          )}
          <p className="mt-1.5 text-terminal-text-dim">{m.not}</p>
        </div>
      )}
    </div>
  )
}
