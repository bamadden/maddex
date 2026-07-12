import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { supabase } from '../../lib/supabase'
import { fetchYahooQuote } from '../../services/api'
import { detectAssetType, toYahooSymbol } from '../../utils/assetUtils'

const POPULAR = ['BHP.AX', 'CBA.AX', 'AAPL', 'BTC']

export default function OnboardingFlow({ onComplete }) {
  const { profile, updateProfile } = useAuthStore()
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [watchlistItems, setWatchlistItems] = useState([])
  const [addError, setAddError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [currency, setCurrency] = useState('AUD')
  const [defaultModule, setDefaultModule] = useState('markets')
  const [finishing, setFinishing] = useState(false)

  // Auto-advance from step 0 after 3 seconds
  useEffect(() => {
    if (step !== 0) return
    const t = setTimeout(() => setStep(1), 3000)
    return () => clearTimeout(t)
  }, [step])

  const handleAddSymbol = async (sym) => {
    const s = sym.trim().toUpperCase()
    if (!s || watchlistItems.includes(s)) return
    setAddError(null); setAdding(true)
    try {
      const type = detectAssetType(s)
      const yfSym = toYahooSymbol(s, type)
      await fetchYahooQuote(yfSym)
      setWatchlistItems(prev => [...prev, s])
      setSearch('')
    } catch {
      setAddError('Symbol not found')
    } finally {
      setAdding(false)
    }
  }

  const handleFinish = async () => {
    setFinishing(true)
    const userId = profile?.id
    if (userId && watchlistItems.length > 0) {
      await supabase.from('watchlist').insert(
        watchlistItems.map((sym, i) => ({ user_id: userId, symbol: sym, position: i }))
      )
    }
    if (userId) {
      await supabase.from('user_settings')
        .update({ currency, default_module: defaultModule, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
    }
    await updateProfile({ onboarding_complete: true })
    onComplete()
  }

  const firstName = profile?.first_name || 'there'

  if (step === 0) {
    return (
      <div className="fixed inset-0 z-[200] bg-terminal-bg flex flex-col items-center justify-center gap-6 font-mono"
        style={{ backgroundImage: 'radial-gradient(circle, #0d2244 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        <div className="text-terminal-gold text-2xl font-bold tracking-[0.3em]">▲ MADDEX</div>
        <div className="text-center space-y-2">
          <div className="text-terminal-text-bright text-lg font-bold">Welcome to Maddex, {firstName}</div>
          <div className="text-terminal-text-dim text-xs">Your professional financial intelligence terminal.</div>
        </div>
        <button
          onClick={() => setStep(1)}
          className="px-6 py-2.5 text-xs font-bold border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors tracking-widest"
        >
          LAUNCH TERMINAL →
        </button>
        <div className="text-2xs text-terminal-text-dim/40">Auto-advancing in 3s...</div>
      </div>
    )
  }

  if (step === 1) {
    return (
      <div className="fixed inset-0 z-[200] bg-terminal-bg flex items-center justify-center font-mono"
        style={{ backgroundImage: 'radial-gradient(circle, #0d2244 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        <div className="w-full max-w-md border border-terminal-gold bg-terminal-panel p-6 mx-4 space-y-5">
          <div>
            <div className="text-terminal-gold text-xs font-bold tracking-widest mb-1">STEP 1 OF 2</div>
            <div className="text-terminal-text-bright text-sm font-bold tracking-wider">BUILD YOUR WATCHLIST</div>
            <div className="text-terminal-text-dim text-2xs mt-1">Track the stocks and assets that matter to you.</div>
          </div>

          <form onSubmit={e => { e.preventDefault(); handleAddSymbol(search) }} className="flex gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value.toUpperCase())}
              placeholder="Search ASX or US stocks..."
              disabled={adding}
              className="flex-1 bg-terminal-bg border border-terminal-border px-3 py-2 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono placeholder-terminal-text-dim/50"
            />
            <button
              type="submit"
              disabled={adding || !search.trim()}
              className="px-4 py-2 text-xs font-bold border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors disabled:opacity-40"
            >
              {adding ? '...' : 'ADD'}
            </button>
          </form>

          {addError && <div className="text-2xs text-terminal-red">{addError}</div>}

          <div className="space-y-1">
            <div className="text-2xs text-terminal-text-dim">Popular:</div>
            <div className="flex gap-2 flex-wrap">
              {POPULAR.map(s => (
                <button
                  key={s}
                  onClick={() => handleAddSymbol(s)}
                  disabled={watchlistItems.includes(s) || adding}
                  className={`px-2 py-0.5 text-2xs border transition-colors ${
                    watchlistItems.includes(s)
                      ? 'border-terminal-green text-terminal-green'
                      : 'border-terminal-border text-terminal-text-dim hover:border-terminal-gold hover:text-terminal-gold'
                  }`}
                >
                  {watchlistItems.includes(s) ? '✓ ' : ''}{s}
                </button>
              ))}
            </div>
          </div>

          {watchlistItems.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {watchlistItems.map(s => (
                <span key={s} className="px-2 py-0.5 text-2xs bg-terminal-accent/30 border border-terminal-border text-terminal-gold flex items-center gap-1">
                  {s}
                  <button onClick={() => setWatchlistItems(p => p.filter(x => x !== s))} className="text-terminal-text-dim hover:text-terminal-red">✕</button>
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(2)} className="text-2xs text-terminal-text-dim hover:text-terminal-text underline">SKIP →</button>
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-xs font-bold border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
            >
              CONTINUE →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[200] bg-terminal-bg flex items-center justify-center font-mono"
      style={{ backgroundImage: 'radial-gradient(circle, #0d2244 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <div className="w-full max-w-md border border-terminal-gold bg-terminal-panel p-6 mx-4 space-y-5">
        <div>
          <div className="text-terminal-gold text-xs font-bold tracking-widest mb-1">STEP 2 OF 2</div>
          <div className="text-terminal-text-bright text-sm font-bold tracking-wider">QUICK SETUP</div>
          <div className="text-terminal-text-dim text-2xs mt-1">Set your preferences to personalise Maddex.</div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-2xs text-terminal-text-dim mb-2">DEFAULT CURRENCY</div>
            <div className="flex border border-terminal-border w-32">
              {['AUD', 'USD'].map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`flex-1 py-1.5 text-xs font-bold transition-colors ${
                    currency === c ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-2xs text-terminal-text-dim mb-2">HOME SCREEN</div>
            <select
              value={defaultModule}
              onChange={e => setDefaultModule(e.target.value)}
              className="bg-terminal-bg border border-terminal-border px-3 py-1.5 text-xs text-terminal-text-bright outline-none focus:border-terminal-gold font-mono"
            >
              {['markets', 'crypto', 'fx', 'macro', 'watchlist', 'news', 'global'].map(m => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleFinish}
          disabled={finishing}
          className="w-full py-2.5 text-xs font-bold bg-terminal-gold text-terminal-bg tracking-widest hover:bg-terminal-gold-bright transition-colors disabled:opacity-50"
        >
          {finishing ? '...' : 'LAUNCH MADDEX →'}
        </button>
      </div>
    </div>
  )
}
