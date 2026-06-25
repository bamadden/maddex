// Three variants:
// <DataUnavailable onRetry={fn} label="..." />  — general failure
// <UpgradeRequired feature="..." />  — premium API required
// <RateLimited service="..." onRetry={fn} />  — 429/quota exhausted

export function DataUnavailable({ label = 'DATA UNAVAILABLE', onRetry, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 p-4 text-center ${className}`}>
      <span className="text-terminal-red text-2xs font-bold">&#9888; {label}</span>
      <span className="text-terminal-text-dim text-2xs">API call failed or timed out</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 text-2xs text-terminal-gold border border-terminal-gold px-3 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
        >
          RETRY
        </button>
      )}
    </div>
  )
}

export function UpgradeRequired({ feature = 'This data' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-4 text-center">
      <span className="text-terminal-gold text-2xs font-bold">&#11014; UPGRADE REQUIRED</span>
      <span className="text-terminal-text-dim text-2xs">{feature} requires a premium API subscription</span>
    </div>
  )
}

export function RateLimited({ service = 'API', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-4 text-center">
      <span className="text-terminal-gold text-2xs font-bold">&#9203; RATE LIMITED</span>
      <span className="text-terminal-text-dim text-2xs">{service} daily quota exhausted. Resets at midnight UTC.</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 text-2xs text-terminal-gold border border-terminal-gold px-3 py-0.5 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
        >
          RETRY
        </button>
      )}
    </div>
  )
}
