import { isASXStock } from './asxTickers'
import { toYahooSymbol } from './assetUtils'

// Guards against pricing a holding off the wrong exchange.
//
// THE FAILURE THIS EXISTS TO CATCH
//
// Passing a bare 'BHP' to a quote API does not error. It returns BHP's
// US-listed ADR — a real security, at a real price, in US dollars — instead
// of BHP.AX. The caller treats it as an ASX holding, applies no currency
// conversion, and reports a confident total that is wrong by a factor of
// four. Nothing in the stack objects at any point.
//
// This is not hypothetical. The dashboard's portfolio widget priced three of
// five positions off the wrong exchange and showed A$136,060 against the
// portfolio page's A$47,587 for identical holdings. Both figures looked like
// plausible portfolios, which is why it survived a build, a lint pass and a
// screenshot.
//
// The rule is: quotes are fetched by yfSym, never by symbol. These two
// helpers make breaking it loud instead of silent.

export { isASXStock }

// Warns when a symbol looks ASX-listed but carries no .AX suffix.
//
// Development only. In production this is noise a user cannot act on, and the
// point of the check is to catch the mistake while it is being written.
export function warnIfBareASX(symbols, context = 'quote fetch') {
  if (!import.meta.env?.DEV) return
  const suspect = (Array.isArray(symbols) ? symbols : [symbols])
    .map((s) => String(s ?? ''))
    .filter((s) => s && !s.endsWith('.AX') && isASXStock(s))
  if (!suspect.length) return
  console.warn(
    `[Quote] Possible wrong exchange in ${context}: ${suspect.join(', ')} — `
    + `did you mean ${suspect.map((s) => `${s}.AX`).join(', ')}? A bare ASX ticker `
    + 'resolves to the US listing at a USD price, silently. Fetch quotes by yfSym, not symbol.',
  )
}

// The symbol a holding should be priced with.
//
// Throws in development, so a missing yfSym stops the person who introduced
// it rather than reaching a user as a wrong number. In production it derives
// the symbol and warns instead: a holding saved before yfSym existed is a real
// record in someone's storage, and crashing their portfolio to enforce an
// internal convention punishes them for our schema change. Deriving it is
// what the portfolio module already did as its own fallback, so this is no
// worse than the status quo — it is just no longer silent.
export function requireYFSym(holding) {
  if (holding?.yfSym) return holding.yfSym

  const message =
    `Holding ${holding?.symbol ?? '(unknown)'} has no yfSym — `
    + 'pricing it by bare symbol can fetch the wrong exchange.'

  if (import.meta.env?.DEV) throw new Error(`[Quote] ${message}`)

  console.warn(`[Quote] ${message} Deriving it from symbol and type.`)
  return toYahooSymbol(holding?.symbol ?? '', holding?.type)
}
