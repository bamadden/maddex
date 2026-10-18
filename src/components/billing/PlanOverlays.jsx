import { lazy, Suspense, useEffect, useState } from 'react'

// Listens for the plan events and shows the matching modal. The modals
// themselves (pricing, waitlist, upgrade prompt) live in PlanModals and load
// on the first event — nobody needs the pricing page on first paint.
const PricingModal    = lazy(() => import('./PlanModals').then((m) => ({ default: m.PricingModal })))
const ComingSoonModal = lazy(() => import('./PlanModals').then((m) => ({ default: m.ComingSoonModal })))
const GateModal       = lazy(() => import('./PlanModals').then((m) => ({ default: m.GateModal })))

export default function PlanOverlays() {
  const [pricing, setPricing] = useState(false)
  const [gate, setGate] = useState(null)        // { feature, message }
  const [upgrade, setUpgrade] = useState(null)  // { tier }

  useEffect(() => {
    const onPricing = () => { setGate(null); setPricing(true) }
    const onGate = (e) => setGate(e.detail ?? null)
    const onUpgrade = (e) => { setGate(null); setUpgrade(e.detail ?? {}) }
    window.addEventListener('maddex:open-pricing', onPricing)
    window.addEventListener('maddex:gate', onGate)
    window.addEventListener('maddex:upgrade', onUpgrade)
    return () => {
      window.removeEventListener('maddex:open-pricing', onPricing)
      window.removeEventListener('maddex:gate', onGate)
      window.removeEventListener('maddex:upgrade', onUpgrade)
    }
  }, [])

  return (
    <>
      {gate && <Suspense fallback={null}><GateModal gate={gate} onClose={() => setGate(null)} /></Suspense>}
      {pricing && <Suspense fallback={null}><PricingModal onClose={() => setPricing(false)} /></Suspense>}
      {upgrade && <Suspense fallback={null}><ComingSoonModal tier={upgrade.tier} onClose={() => setUpgrade(null)} /></Suspense>}
    </>
  )
}
