// One sentence, the same everywhere, on every list Maddex keeps only in this
// browser (Phase C, 16 Nov 2026): what is stored, that it is not in the
// account, and what removes it. The watchlist and portfolio have sync bars
// instead, because they also have an account copy.
export default function DeviceOnlyNote({ what, className = '' }) {
  return (
    <div className={`text-2xs text-terminal-text-dim ${className}`} data-device-only>
      Saved on this device only: {what} {/s$/.test(what) ? 'are' : 'is'} not stored in your account, and clearing this browser&apos;s data removes {/s$/.test(what) ? 'them' : 'it'}.
    </div>
  )
}
