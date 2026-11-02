import { useCallback, useSyncExternalStore } from 'react'

// The one ticker behind every on-screen clock and countdown. Each component
// used to run its own one-second setInterval, started whenever it mounted,
// so at a minute boundary two clocks could show different minutes for up to
// a second (the UI test caught "00:37 AEDT" beside "00:38 AEDT"). Now one
// timer, aligned to the wall-clock second, publishes one value and every
// subscriber renders from it in the same tick.
//
// useNow()        ms since epoch, updated every second
// useNow(30_000)  the same clock, re-rendering only when a 30 s bucket
//                 rolls over (for panels too heavy to repaint every second)
//
// The timer runs only while something is subscribed.

let now = Date.now()
const subscribers = new Set()
let timer = null

function tick() {
  now = Date.now()
  for (const notify of subscribers) notify()
  timer = setTimeout(tick, 1000 - (now % 1000))
}

function subscribe(notify) {
  subscribers.add(notify)
  if (!timer) {
    now = Date.now() // the value may be stale after a spell with no subscribers
    timer = setTimeout(tick, 1000 - (now % 1000))
  }
  return () => {
    subscribers.delete(notify)
    if (!subscribers.size) { clearTimeout(timer); timer = null }
  }
}

export function useNow(every = 1000) {
  const snapshot = useCallback(() => (every <= 1000 ? now : now - (now % every)), [every])
  return useSyncExternalStore(subscribe, snapshot)
}
