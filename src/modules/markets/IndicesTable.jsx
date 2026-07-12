import { useState, useRef } from 'react'
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
  const lastClickTime   = useRef(0)
  const lastClickSymbol = useRef(null)

  const handleClick = (symbol, q, isAud, label) => {
    const now = Date.now()
    const isDouble = (now - lastClickTime.current) < 400 && lastClickSymbol.current === symbol
    lastClickTime.current   = now
    lastClickSymbol.current = symbol

    if (isDouble) {
      if (q) openModal?.({
        symbol: symbol.replace('^', ''),
        name:   label,
        price:  isAud ? q.last : usdToAud(q.last),
        pct:    q.pct,
        change: isAud ? q.change : usdToAud(q.change),
        type:   'index',
      })
    } else {
      onSelectIndex?.(symbol)
    }
  }

  const { data: quotes, isError, isFetching, refetch } = useQuery({
    queryKey:  ['yfBatch', 'indices'],
    queryFn:   () => fetchYFBatch(ALL_SYMBOLS),
    staleTime: 60_000,
    retry: 1,
  })

  return (
    <>
    <div style={{ display: 'flex', alignItems: 'stretch', width: '100%', background: 'var(--color-terminal-header, #071428)' }}>
      <div className="px-2 py-1.5 border-r border-terminal-border flex-shrink-0 flex items-center">
        <span className="text-2xs text-terminal-gold font-bold tracking-widest whitespace-nowrap">GLOBAL INDICES</span>
      </div>

      {YF_INDICES.map(({ symbol, label, sublabel, isAud, primary }, idx) => {
        const q        = quotes?.[symbol]
        const dataDate = q?.timestamp ? fmtDataDate(q.timestamp) : null
        const isStale  = !!dataDate
        const isSelected = symbol === selectedIndex
        const isLast   = idx === YF_INDICES.length - 1

        return (
          <div
            key={symbol}
            className={`flex flex-col justify-between items-center py-1.5 cursor-pointer hover:bg-terminal-accent/20 ${isSelected ? 'bg-[rgba(201,168,76,0.06)]' : ''}`}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '6px 4px',
              borderRight: isLast ? 'none' : isSelected ? '2px solid #c9a84c' : '1px solid rgba(30,60,120,0.35)',
              transition: 'background 150ms',
              minWidth: 0,
            }}
            onClick={() => handleClick(symbol, q, isAud, label)}
          >
            <span className={`text-2xs font-bold block ${isSelected ? 'text-terminal-gold' : primary ? 'text-terminal-gold/70' : 'text-terminal-text-dim'}`}>
              {label}
            </span>
            <span className="text-2xs text-terminal-text-dim/50 block">{sublabel}</span>

            {isFetching && !q ? (
              <span className="text-2xs text-terminal-text-dim animate-pulse block">···</span>
            ) : !q && isError ? (
              <button
                className="text-2xs text-terminal-red hover:text-terminal-gold cursor-pointer"
                onClick={(e) => { e.stopPropagation(); refetch() }}
              >
                ⚠
              </button>
            ) : q ? (
              <>
                <span className="text-xs font-semibold text-terminal-text-bright block">
                  {fmt.price(q.last, 0)}
                </span>
                <span className="text-2xs font-semibold block" style={{ color: pctColor(q.pct) ?? 'var(--color-neutral)' }}>
                  {q.pct >= 0 ? '+' : ''}{q.pct.toFixed(2)}%
                </span>
                <span className="text-2xs block" style={{ color: isStale ? '#c9a84b' : 'rgba(100,130,160,0.4)', fontSize: 8 }}>
                  {isStale ? dataDate : q.isOpen ? 'LIVE' : 'DELAYED'}
                </span>
              </>
            ) : (
              <span className="text-2xs text-terminal-text-dim block">—</span>
            )}
          </div>
        )
      })}
    </div>
    <div style={{ textAlign: 'right', padding: '2px 8px', fontSize: 9, color: 'rgba(100,130,160,0.5)', fontStyle: 'italic' }}>
      Click to select &middot; Double-click for detail
    </div>
    </>
  )
}
