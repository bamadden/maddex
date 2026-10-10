import { useSubscription } from '../../hooks/useSubscription'
import { planFor } from '../../services/plans'
import UpgradePrompt from '../ui/UpgradePrompt'

// A module the current plan does not include renders as a glimpse — the real
// module, blurred, inert and dimmed — under the upgrade prompt. Showing what
// is behind the lock sells it better than an empty panel, and `inert` keeps
// it from taking focus, clicks or keyboard input.
//
// Wrappers are cached per (module, feature) so the component identity is
// stable across renders; a fresh wrapper each render would remount the
// module on every parent update.
const cache = new Map()

export function gatedModule(Module, feature) {
  const key = Module
  if (!cache.has(key)) cache.set(key, new Map())
  const byFeature = cache.get(key)
  if (!byFeature.has(feature)) {
    function Gated(props) {
      const { canUse } = useSubscription()
      if (canUse(feature)) return <Module {...props} />
      return (
        <div className="relative h-full overflow-hidden">
          <div inert aria-hidden="true" className="h-full pointer-events-none select-none"
            style={{ filter: 'blur(3px) saturate(0.6)', opacity: 0.45 }}>
            <Module {...props} />
          </div>
          <UpgradePrompt featureKey={feature} requiredTier={planFor(feature)} />
        </div>
      )
    }
    Gated.displayName = `Gated(${Module.displayName || Module.name || 'Module'})`
    byFeature.set(feature, Gated)
  }
  return byFeature.get(feature)
}
