import { useState, useEffect } from 'react'

// Pulses green/red briefly when `value` changes — for numbers that update
// in discrete jumps (a portfolio total recalculating, a stat recomputing),
// not per-tick price cells, which already get useLivePrice's flash-on-tick
// treatment (see index.css's .price-flash-up/-down) — using both on the
// same cell would be redundant.
export default function AnimatedNumber({ value, format = (v) => v, className = '' }) {
  const [state, setState] = useState(() => ({ value, animClass: '' }))

  // Derived-state-during-render (not an effect) so the pulse direction is
  // computed from the actual previous value, not a stale closure.
  if (state.value !== value) {
    const animClass = (value != null && state.value != null && value > state.value) ? 'count-up'
      : (value != null && state.value != null && value < state.value) ? 'count-down' : ''
    setState({ value, animClass })
  }

  useEffect(() => {
    if (!state.animClass) return undefined
    const id = setTimeout(() => setState((s) => ({ ...s, animClass: '' })), 500)
    return () => clearTimeout(id)
  }, [state.animClass])

  return <span className={`${state.animClass} ${className}`}>{format(state.value)}</span>
}
