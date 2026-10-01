import { useEffect, useState } from 'react'
import { takeModuleIntent } from '../services/moduleIntent'

// One field of a module's state that a command-bar intent can set: read once
// on mount (cold open), then kept in step with intents sent while the module
// is already showing. See moduleIntent.js for why both paths are needed.
export function useIntentState(module, field, initial) {
  const [value, setValue] = useState(() => takeModuleIntent(module)?.[field] ?? initial)
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
