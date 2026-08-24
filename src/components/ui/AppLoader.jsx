import { useState, useEffect } from 'react'

// Shown while the app is still initialising (auth check + a short minimum
// hold, see AuthGate in App.jsx) — not a fixed fake timer, so it never
// lingers longer than the real work actually takes.
export default function AppLoader() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setProgress((p) => Math.min(p + Math.random() * 15, 95)), 120)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="fixed inset-0 z-[100] bg-terminal-bg flex flex-col items-center justify-center gap-6 font-mono">
      <div className="flex flex-col items-center gap-3">
        <div className="text-terminal-gold text-4xl font-bold tracking-[0.3em]">▲ MADDEX</div>
        <div className="text-terminal-text-dim text-xs tracking-[0.5em]">FINANCIAL INTELLIGENCE</div>
      </div>
      <div className="w-48 h-0.5 bg-terminal-border overflow-hidden">
        <div className="h-full bg-terminal-gold transition-all duration-200" style={{ width: `${progress}%` }} />
      </div>
      <div className="text-terminal-text-dim text-2xs tracking-widest animate-pulse">INITIALISING TERMINAL...</div>
    </div>
  )
}
