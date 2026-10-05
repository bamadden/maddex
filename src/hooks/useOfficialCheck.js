import { useEffect, useState } from 'react'
import { getOfficialCheck, subscribeOfficialCheck } from '../services/officialStats'

// The latest RBA/ABS reconciliation, live-updating when a check completes.
export function useOfficialCheck() {
  const [check, setCheck] = useState(getOfficialCheck)
  useEffect(() => subscribeOfficialCheck(setCheck), [])
  return check
}
