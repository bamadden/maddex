// A one-shot message to a module that is about to be opened.
//
// THE PROBLEM
//
// "scan for oversold" has to navigate to the Scanner AND select a tab. Doing
// that with an event alone does not work: modules are lazy-loaded, so at the
// moment the command runs the Scanner's chunk may not have been fetched, let
// alone mounted and listening. The event fires into an empty room and the user
// lands on whatever tab was there before — which is exactly what happened, and
// which looks like the command half-worked rather than like a race.
//
// A delay would not fix it either, only make the race less frequent.
//
// THE SHAPE
//
// The caller leaves an intent, then navigates. The module reads it in its
// useState initialiser, which runs on mount however long that takes. Reading
// consumes it, so a later manual visit to the same module does not replay a
// command from ten minutes ago.
//
// In-memory rather than storage: an intent is about this navigation, and one
// surviving a page reload would be a small haunting.

const intents = new Map()

export function setModuleIntent(module, intent) {
  intents.set(module, intent)
}

// Reads and clears. Returns null when there is nothing waiting.
export function takeModuleIntent(module) {
  if (!intents.has(module)) return null
  const value = intents.get(module)
  intents.delete(module)
  return value ?? null
}
