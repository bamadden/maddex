// Resolves when the page is visible — at once if it already is. Background
// AI work waits on this, so a tab left open in the background over a day
// rollover does not spend a completion nobody is looking at.
export function whenVisible() {
  if (typeof document === 'undefined' || !document.hidden) return Promise.resolve()
  return new Promise((resolve) => {
    const on = () => {
      if (document.hidden) return
      document.removeEventListener('visibilitychange', on)
      resolve()
    }
    document.addEventListener('visibilitychange', on)
  })
}
