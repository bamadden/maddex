import { useSyncExternalStore } from 'react'
import { getInvestorProfile, subscribeInvestorProfile } from '../services/investorProfile'

// The saved investor profile, or null. Re-renders on save/clear in this tab
// and on edits from another tab.
export function useInvestorProfile() {
  return useSyncExternalStore(subscribeInvestorProfile, getInvestorProfile, () => null)
}
