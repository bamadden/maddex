// ANALYST COVERAGE for stocks with no live consensus data. Says plainly what
// is missing. MaddenAI's own CONSTRUCTIVE/BALANCED/CAUTIOUS "stance" sat here
// until 1 Nov 2026 — an AI-made rating on a security — and is gone.

export default function AnalystCoverage() {
  return (
    <div className="text-2xs font-mono space-y-1.5">
      <div className="text-terminal-text-dim/60">Where public data is available.</div>
      <div className="flex justify-between"><span className="text-terminal-text-dim">Broker coverage</span><span className="text-terminal-text-dim/70">Not available — needs a live consensus feed</span></div>
      <div className="flex justify-between"><span className="text-terminal-text-dim">Average target</span><span className="text-terminal-text-dim/70">Not shown — Maddex does not publish price targets</span></div>
    </div>
  )
}
