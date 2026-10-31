// Who may see the Relationships review queue.
//
// In development: always (it is Ben's machine, and the queue's write endpoint
// only exists on the dev server). In production: an Apex account whose
// Supabase user id is listed in VITE_GRAPH_REVIEWERS (comma-separated, set
// in Vercel). Ids, not emails, so no address is ever compiled into the
// bundle. With the variable unset, nobody sees it in production.
const REVIEWERS = String(import.meta.env.VITE_GRAPH_REVIEWERS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

export function canReviewGraph({ tier, userId } = {}) {
  if (import.meta.env.DEV) return true
  return tier === 'apex' && !!userId && REVIEWERS.includes(userId)
}

// Approving writes to the repo, which only the dev server can do.
export const canWriteGraph = () => !!import.meta.env.DEV
