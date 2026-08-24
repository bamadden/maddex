export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-terminal-bg flex flex-col items-center justify-center font-mono gap-4 px-4 text-center">
      <div className="text-terminal-gold text-6xl font-bold tracking-widest">404</div>
      <div className="text-terminal-text-bright text-sm font-bold tracking-[0.2em]">MODULE NOT FOUND</div>
      <div className="text-terminal-text-dim text-2xs max-w-sm">The page you're looking for doesn't exist.</div>
      <a
        href="/"
        className="mt-2 text-2xs font-bold text-terminal-gold border border-terminal-gold/50 px-5 py-2 hover:bg-terminal-gold hover:text-terminal-bg transition-colors"
      >RETURN TO MARKETS</a>
    </div>
  )
}
