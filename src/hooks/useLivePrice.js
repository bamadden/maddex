import { useState, useEffect, useRef } from 'react'
import { priceStream } from '../services/priceStreamService'
import { getMockFMPRow } from '../services/mockData'

// Subscribes a component to the simulated live tick stream for one symbol.
// `quote` is the latest simulated FMP-row-shaped quote; `flash` is
// 'up' | 'down' | null for ~400ms after each tick, for a flash-highlight
// effect — components decide what to do with it (e.g. price-flash-up class).
export function useLivePrice(symbol) {
  const [state, setState] = useState(() => ({
    symbol,
    quote: symbol ? getMockFMPRow(symbol) : null,
  }))
  const [flash, setFlash] = useState(null)
  const flashTimerRef = useRef(null)

  // Resync synchronously during render when `symbol` changes, rather than
  // setState-in-effect, to avoid an extra cascading render.
  if (state.symbol !== symbol) {
    setState({ symbol, quote: symbol ? priceStream.getSnapshot(symbol) : null })
  }

  useEffect(() => {
    if (!symbol) return undefined
    priceStream.start()

    const unsubscribe = priceStream.subscribe(symbol, (updatedQuote) => {
      setFlash(updatedQuote.lastTick)
      setState({ symbol, quote: updatedQuote })
      clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => setFlash(null), 400)
    })

    return () => {
      unsubscribe()
      clearTimeout(flashTimerRef.current)
    }
  }, [symbol])

  return { quote: state.quote, flash }
}
