import { useEffect, useState } from 'react'
import { useSubscription } from './useSubscription'
import { useAuthStore } from '../store/useAuthStore'
import { canReviewGraph } from '../services/graphReviewAccess'

// Whether this viewer may see the Relationships review queue, and how many
// proposals are waiting. The count is loaded lazily, so nobody else ever
// downloads the queue.
export function useGraphReview() {
  const { tier } = useSubscription()
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const canReview = canReviewGraph({ tier, userId })
  const [pending, setPending] = useState(0)
  useEffect(() => {
    if (!canReview) return undefined
    let alive = true
    import('../data/graph/reviewQueue').then((m) => { if (alive) setPending(m.pendingCount()) }).catch(() => {})
    return () => { alive = false }
  }, [canReview])
  return { canReview, pending }
}
