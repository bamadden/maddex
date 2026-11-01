// Clickable rows that a keyboard can reach.
//
// Many tables and lists handle a click on a <tr>, <div> or <li> (a stock row
// that opens its detail). Those are not focusable, so a keyboard user could
// not open a stock at all. This makes every such element reachable with Tab
// and operable with Enter or Space, in one place rather than in ~200 call
// sites: an element is "clickable" when it is styled with cursor: pointer (the
// cursor-pointer class or an inline style) and is not already interactive.
//
// Rows keep their table semantics (no role is added to a <tr>); other
// elements get role="button".

const SELECTOR = [
  'tr[class*="cursor-pointer"]', 'div[class*="cursor-pointer"]', 'li[class*="cursor-pointer"]', 'span[class*="cursor-pointer"]', 'td[class*="cursor-pointer"]',
  'tr[style*="cursor: pointer"]', 'div[style*="cursor: pointer"]', 'li[style*="cursor: pointer"]', 'span[style*="cursor: pointer"]', 'td[style*="cursor: pointer"]',
].join(',')
const INTERACTIVE = 'a,button,input,select,textarea,[tabindex],[contenteditable="true"]'

export function enhance(root) {
  for (const el of root.querySelectorAll(SELECTOR)) {
    if (el.matches(INTERACTIVE) || el.hasAttribute('data-kb-click')) continue
    // A clickable wrapper whose only job is to hold a real control.
    if (el.querySelector(':scope > button:only-child, :scope > a:only-child')) continue
    el.setAttribute('tabindex', '0')
    el.setAttribute('data-kb-click', '')
    if (el.tagName !== 'TR' && el.tagName !== 'TD' && !el.hasAttribute('role')) el.setAttribute('role', 'button')
  }
}

export function onKeydown(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return
  const el = e.target
  if (!(el instanceof Element) || !el.hasAttribute('data-kb-click')) return
  e.preventDefault()
  el.click()
}

// Watches the document and enhances new rows as they render. Returns a stop
// function.
export function startKeyboardClickables(doc = document) {
  let queued = false
  const run = () => { queued = false; enhance(doc.body) }
  const observer = new MutationObserver(() => {
    if (queued) return
    queued = true
    requestAnimationFrame(run)
  })
  run()
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
  doc.addEventListener('keydown', onKeydown)
  return () => { observer.disconnect(); doc.removeEventListener('keydown', onKeydown) }
}
