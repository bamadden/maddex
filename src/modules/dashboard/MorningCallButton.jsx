import { useEffect, useState } from 'react'
import { askMaddenAI } from '../../utils/askAI'

// MORNING CALL — weekdays 6–10am Sydney time. The interactive counterpart to
// the pre-generated morning brief: MaddenAI gets today's date, the verified
// figures and today's scheduled events in its usual per-turn context, and
// this asks for the call. Overnight developments are whatever that context
// and the news feed carry — the prompt asks it not to invent any.

function inWindow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', weekday: 'short', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]))
  const h = Number(parts.hour)
  return !['Sat', 'Sun'].includes(parts.weekday) && h >= 6 && h < 10
}

const PROMPT = 'Give me the morning call. What do I need to know to start today? Cover overnight moves and developments you have been given, today’s scheduled events and what each could do, the rates and AUD backdrop, and the two or three things to watch on the ASX today. Use only figures in your context; where you have no overnight figure, say so rather than estimate.'

export default function MorningCallButton() {
  const [open, setOpen] = useState(() => inWindow())
  useEffect(() => {
    const id = setInterval(() => setOpen(inWindow()), 60_000)
    return () => clearInterval(id)
  }, [])
  if (!open) return null
  return (
    <button
      onClick={() => askMaddenAI(PROMPT)}
      title="Weekdays 6–10am Sydney: an interactive morning call from MaddenAI"
      className="text-2xs px-2.5 py-1 font-bold tracking-widest bg-terminal-gold text-terminal-bg hover:bg-terminal-gold-bright transition-colors"
    >☀ MORNING CALL</button>
  )
}
