import { useQuery } from '@tanstack/react-query'
import { fetchYFBatch, YF_INDICES } from '../../services/api'
import { useAudRates } from '../../hooks/useAudRates'
import { fmt } from '../../utils/format'

const ALL_SYMBOLS = YF_INDICES.map((i) => i.symbol)

// Format stooq timestamp (YYYY-MM-DD) to a compact display
function fmtDataDate(ts) {
  if (!ts) return null
  const d = new Date(ts + 'T00:00:00')
  if (isNaN(d)) return null
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return null  // today's data — no label needed
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function pctColor(pct) {
  if (pct > 0) return 'var(--color-gain)'
  if (pct < 0) return 'var(--color-loss)'
  return undefined
}

export default function IndicesTable({ openModal, selectedIndex, onSelectIndex }) {
  const { usdToAud } = useAudRates()

  const { data: quotes, isError, isFetching, refetch } = useQuery({
    queryKey:  ['yfBatch', 'indices'],
    queryFn:   () => fetchYFBatch(ALL_SYMBOLS),
    staleTime: 60_000,
    retry: 1,
  })

  const updatedTime = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex flex-nowrap overflow-x-auto bg-terminal-header">
      <div className="px-2 py-1.5 border-r border-terminal-border flex-shrink-0 flex items-center">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest whitespace-nowrap">GLOBAL INDICES</span>
      </div>

      {YF_INDICES.map(({ symbol, label, sublabel, isAud, primary }) => {
        const q       = quotes?.[symbol]
        const dataDate = q?.timestamp ? fmtDataDate(q.timestamp) : null
        const isStale  = !!dataDate
        const isSelected = symbol === selectedIndex

        return (
          <div
            key={symbol}
            className={`
              flex flex-col justify-between px-3 py-1.5 border-r border-terminal-border flex-shrink-0
              cursor-pointer hover:bg-terminal-accent/20
              ${primary ? 'min-w-[140px]' : 'min-w-[120px]'}
              ${isSelected ? 'bg-[rgba(201,168,76,0.06)]' : ''}
            `}
            style={{
              borderRight: isSelected ? '3px solid var(--mt-gold, #C9A84C)' : undefined,
              transition: 'background 150ms, border-color 150ms',
            }}
            onClick={() => {
              onSelectIndex?.(symbol)
              if (q) openModal?.({
                symbol: symbol.replace('^', ''),
                name:   label,
                price:  isAud ? q.last : usdToAud(q.last),
                pct:    q.pct,
                change: isAud ? q.change : usdToAud(q.change),
                type:   'index',
              })
            }}
          >
            <div className="flex items-center gap-1">
              <span className={`text-2xs font-bold ${isSelected ? 'text-terminal-gold' : primary ? 'text-terminal-gold/70' : 'text-terminal-text-dim'}`}>
                {label}
              </span>
            </div>
            <div className="text-2xs text-terminal-text-dim/60">{sublabel}</div>

            {isFetching && !q ? (
              <span className="text-2xs text-terminal-text-dim animate-pulse">LOADING...</span>
            ) : !q && isError ? (
              <button
                className="text-2xs text-terminal-red hover:text-terminal-gold cursor-pointer text-left"
                onClick={(e) => { e.stopPropagation(); refetch() }}
              >
                ⚠ RETRY
              </button>
            ) : q ? (
              <>
                <span className={`font-semibold ${primary ? 'text-sm text-terminal-text-bright' : 'text-xs text-terminal-text-bright'}`}>
                  {fmt.price(q.last, 0)} pts
                </span>
                <span className="text-2xs font-semibold" style={{ color: pctColor(q.pct) ?? 'var(--color-neutral)' }}>
                  {q.pct >= 0 ? '+' : ''}{q.pct.toFixed(2)}%
                </span>
                {isStale ? (
                  <span className="text-2xs text-terminal-gold/70">LAST CLOSE {dataDate}</span>
                ) : (
                  <span className="text-2xs text-terminal-text-dim/50">
                    {q.isOpen ? 'LIVE' : 'DELAYED'}
                  </span>
                )}
              </>
            ) : (
              <span className="text-2xs text-terminal-text-dim">—</span>
            )}
          </div>
        )
      })}

      <div className="flex items-center px-3 text-2xs flex-shrink-0 gap-1.5">
        {isFetching
          ? <span className="text-terminal-text-dim/50 italic animate-pulse">LOADING...</span>
          : <span className="text-terminal-text-dim/50 italic">Stooq · {updatedTime} AEST</span>
        }
        {!isFetching && (
          <button onClick={() => refetch()} className="text-terminal-text-dim/40 hover:text-terminal-gold text-2xs">↺</button>
        )}
      </div>
    </div>
  )
}
