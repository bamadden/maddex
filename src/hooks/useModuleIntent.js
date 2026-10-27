import { useEffect, useState } from 'react'
import { peekModuleIntent, takeModuleIntent } from '../services/moduleIntent'

// One field of a module's state that a command-bar intent can set: read once
// on mount (cold open), then kept in step with intents sent while the module
// is already showing. See moduleIntent.js for why both paths are needed.
//
// Peeks on mount and clears in an effect: every initialiser in the render
// (this component's and its children's) runs before any effect, so a module
// can read several fields of one intent. Taking it in the first initialiser
// left the second field reading an empty map.
export function useIntentState(module, field, initial) {
  const [value, setValue] = useState(() => peekModuleIntent(module)?.[field] ?? initial)
  useEffect(() => { takeModuleIntent(module) }, [module])
  useEffect(() => {
    const onIntent = (e) => {
      if (e.detail?.module !== module || e.detail.intent?.[field] == null) return
      takeModuleIntent(module)
      setValue(e.detail.intent[field])
    }
    window.addEventListener('madden:module-intent', onIntent)
    return () => window.removeEventListener('madden:module-intent', onIntent)
  }, [module, field])
  return [value, setValue]
}
