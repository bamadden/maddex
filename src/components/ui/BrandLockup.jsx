// The one Maddex logo: the MX mark and the MADDEX wordmark, used in the top
// bar, on the sign-in screen and in post-signup setup. (The sign-in screen
// used a triangle-and-text mark, and the sidebar repeated the mark under the
// top bar's.)
export default function BrandLockup({ size = 28, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src="/icons/icon-mark-96.png" alt="" aria-hidden="true" style={{ width: size, height: size, objectFit: 'contain' }} />
      <span className="font-mono whitespace-nowrap text-terminal-gold" style={{ fontSize: size >= 36 ? 20 : 11, letterSpacing: '0.25em', fontWeight: 600 }}>
        MADDEX
      </span>
      <span className="sr-only">Maddex</span>
    </span>
  )
}
