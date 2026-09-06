import { useQuery } from '@tanstack/react-query'
import { fetchEquityQuotes } from '../../../services/dataService'
import { ASX_SECTOR_STOCKS, SECTOR_ABBR } from '../../markets/SectorHeatmap'
import {WidgetBody} from './_shared'
import { goModule } from './navigate'

// One representative stock per sector. A full sector aggregate is the
// Markets module's job; this is a glance, and fetching 100 symbols for a
// 160px tile would be the tail wagging the dog.
const SECTORS = Object.keys(ASX_SECTOR_STOCKS ?? {}).slice(0, 8)

export default function SectorBreadthWidget() {
  const leaders = SECTORS.map((s) => ASX_SECTOR_STOCKS[s]?.[0]).filter(Boolean)
  const { data } = useQuery({
    queryKey: ['dashSectorBreadth', leaders],
    queryFn: () => fetchEquityQuotes(leaders),
    enabled: leaders.length > 0,
    staleTime: 60_000,
    retry: 1,
  })
  const rows = data?.data ?? {}

  return (
    <WidgetBody>
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-x-4 gap-y-1.5 content-center">
        {SECTORS.map((sector, i) => {
          const pct = rows[leaders[i]]?.pct
          const up = (pct ?? 0) >= 0
          return (
            <button key={sector} onClick={() => goModule('markets')} className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[9px] truncate min-w-0 flex-1 text-left" style={{ color: '#8BA3C4' }}>
                {SECTOR_ABBR?.[sector] ?? sector}
              </span>
              <span style={{ width: 34, height: 3, borderRadius: 2, background: 'rgba(99,120,153,0.18)', position: 'relative', flexShrink: 0 }}>
                <span style={{
                  position: 'absolute', left: up ? '50%' : undefined, right: up ? undefined : '50%',
                  top: 0, height: 3, borderRadius: 2,
                  width: `${Math.min(50, Math.abs(pct ?? 0) * 16)}%`,
                  background: up ? '#2D8A50' : '#A83232',
                }} />
              </span>
              <span className="font-mono text-[8px] tabular-nums flex-shrink-0" style={{ width: 34, textAlign: 'right', color: up ? '#2D8A50' : '#A83232' }}>
                {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}` : '—'}
              </span>
            </button>
          )
        })}
      </div>
    </WidgetBody>
  )
}
