import { getSharedRecord } from '../services/sharingService'

function priceStr(symbol, price) {
  if (price == null) return '—'
  return `${symbol.endsWith('.AX') ? 'A$' : 'US$'}${price.toFixed(2)}`
}

// Public, read-only view of a shared watchlist — reached via
// maddex.com.au/watchlist/share/[hash] (App.jsx routes the path here before
// the authenticated app mounts, so no sign-in is required to view one).
export default function SharedWatchlistPage({ id }) {
  const record = getSharedRecord('watchlist', id)

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-8">
          <span className="text-terminal-gold text-xl">▲</span>
          <span className="text-terminal-gold font-bold tracking-widest">MADDEX</span>
        </div>

        {!record ? (
          <div className="border border-terminal-border p-6 text-center">
            <div className="text-terminal-text-bright font-bold mb-2">This link isn't available</div>
            <div className="text-2xs text-terminal-text-dim">
              Shared watchlists currently only resolve in the browser that created them (this feature's backend isn't live yet).
            </div>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold text-terminal-text-bright mb-1">{record.payload.ownerName}'s Watchlist</div>
            <div className="text-2xs text-terminal-text-dim mb-6">
              Shared {new Date(record.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} · read-only
            </div>

            <div className="border border-terminal-border divide-y divide-terminal-border/60">
              {record.payload.stocks.map((s) => (
                <div key={s.symbol} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-2xs font-bold text-terminal-text-bright">{s.symbol.replace('.AX', '')}</div>
                    <div className="text-2xs text-terminal-text-dim truncate">{s.name}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xs font-bold text-terminal-text-bright">{priceStr(s.symbol, s.price)}</div>
                    {s.changePct != null && (
                      <div className={`text-2xs font-bold ${s.changePct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                        {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <a
          href="/"
          className="block mt-8 text-center text-2xs font-bold text-terminal-gold border border-terminal-gold/50 py-2.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
        >SIGN UP TO CREATE YOUR OWN →</a>
      </div>
    </div>
  )
}
