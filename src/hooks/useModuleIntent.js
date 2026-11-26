import { useEffect, useRef, useState } from 'react'
import { peekModuleIntent, takeModuleIntent, recordIntentValue } from '../services/moduleIntent'

// One field of a module's state that a command-bar intent can set: read once
// on mount (cold open), then kept in step with intents sent while the module
// is already showing. See moduleIntent.js for why both paths are needed.
//
// Peeks on mount and clears in an effect: every initialiser in the render
// (this component's and its children's) runs before any effect, so a module
// can read several fields of one intent. Taking it in the first initialiser
// left the second field reading an empty map.
// persist (optional): the module's own save for this field, also called for
// a value that arrives as an intent, so a restored view survives a reload
// (WS2 re-audit L1). A field present in the intent counts even when null
// (the Watchlist's manual order is sortKey null: L2).
export function useIntentState(module, field, initial, persist = null) {
  // initial may be a function, as with useState (a lazy read of storage).
  const [value, setValue] = useState(() => {
    const intent = peekModuleIntent(module)
    return intent && field in intent ? intent[field] : (typeof initial === 'function' ? initial() : initial)
  })
  useEffect(() => { takeModuleIntent(module) }, [module])
  useEffect(() => {
    const onIntent = (e) => {
      if (e.detail?.module !== module || !e.detail.intent || !(field in e.detail.intent)) return
      setValue(e.detail.intent[field])
      // Taken a tick later, so a component this change mounts (the Overview,
      // when a view switches the Dashboard from CUSTOM) can still read its
      // fields (WS2 re-audit M2).
      setTimeout(() => takeModuleIntent(module), 0)
    }
    window.addEventListener('madden:module-intent', onIntent)
    return () => window.removeEventListener('madden:module-intent', onIntent)
  }, [module, field])
  const persistRef = useRef(persist)
  useEffect(() => { persistRef.current = persist })
  // Recorded for saved views (moduleIntent.currentIntent), and saved where the
  // module keeps it.
  useEffect(() => { recordIntentValue(module, field, value); persistRef.current?.(value) }, [module, field, value])
  return [value, setValue]
}
