import { useEffect, useRef, useState } from 'react'
import { ResponsiveContainer } from 'recharts'

// ─── SafeChart ─────────────────────────────────────────────────────────────
//
// A ResponsiveContainer that waits until its container has a real width.
//
// THE WARNING THIS EXISTS TO SILENCE
//
// Recharts logs "The width(-1) and height(-1) of chart should be greater than
// 0" whenever a ResponsiveContainer measures a container that has not been
// laid out yet. In this app that happens constantly and for three different
// reasons: charts inside collapsed CollapsibleSections, charts inside
// lazy-loaded modules that mount before their Suspense boundary has sized the
// box, and charts in flex children whose parent resolves its height a frame
// later. It was the single noisiest thing in the console.
//
// It is only a warning — the chart draws correctly once the observer fires —
// but a console full of warnings is a console nobody reads, and a real error
// hides in it. That is the actual cost.
//
// WHY A HEIGHT PLACEHOLDER MATTERS
//
// Rendering nothing until ready would collapse the container to zero, which
// in a flex column shifts everything below it and then shifts it back a frame
// later. The placeholder reserves the same box the chart will occupy, so the
// layout is stable from first paint.
export default function SafeChart({ height = '100%', width = '100%', minHeight, children, ...rest }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)

  // A percentage height means the box takes its height from a parent that may
  // not have resolved one yet, so BOTH dimensions have to be real before the
  // chart mounts. A numeric height is guaranteed by the placeholder below, so
  // only width can be missing.
  //
  // Checking width alone was not enough — Recharts reports "width(-1) and
  // height(-1)" for a container that has width and no height, and two of
  // those warnings survived the first version of this component.
  const needsHeight = typeof height !== 'number'

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const sized = (w, h) => w > 0 && (!needsHeight || h > 0)

    // Measure synchronously first: in the common case the box is already
    // sized and there is no reason to wait a frame for the observer.
    const box = el.getBoundingClientRect()
    if (sized(box.width, box.height)) {
      setReady(true)
      return
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (sized(entry.contentRect.width, entry.contentRect.height)) {
          setReady(true)
          // Disconnect on first real measurement — this hook only answers
          // "has it been laid out yet". ResponsiveContainer handles every
          // resize after that, and leaving the observer attached would mean
          // two observers on one element for the life of the chart.
          ro.disconnect()
          return
        }
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [needsHeight])

  // A numeric height reserves exactly that; a percentage fills the parent,
  // which is what the flex-child charts rely on.
  const boxHeight = typeof height === 'number' ? height : '100%'

  return (
    <div ref={ref} style={{ width: '100%', height: boxHeight, minHeight }}>
      {ready && (
        <ResponsiveContainer width={width} height={height} {...rest}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  )
}
