// The command bar's first-paint stand-in (WS6, 20 Nov 2026). The real bar
// (its search catalogue, bond and sector data) loads just after first paint;
// until then this same-size shell takes input, and what was typed, and the
// focus, carry over when the real one mounts (CommandBar's `early` prop).
import { earlyCommand } from './commandEarly'

export default function CommandBarShell() {
  return (
    <div data-tour="cmd-bar" className="flex items-center bg-terminal-bg border-t border-terminal-border px-3 py-1.5 gap-3">
      <span className="text-terminal-gold text-2xs font-bold tracking-widest flex-shrink-0 cursor-blink">CMD&gt;</span>
      <input
        className="cmd-input input-terminal flex-1 text-xs"
        aria-label="Command bar: ticker, command or question"
        defaultValue={earlyCommand.value}
        onChange={(e) => { earlyCommand.value = e.target.value }}
        onFocus={() => { earlyCommand.focused = true }}
        onBlur={() => { earlyCommand.focused = false }}
        placeholder="Ticker · Command · Question — type HELP or ? for all commands"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  )
}
