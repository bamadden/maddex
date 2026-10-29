// Maddex service worker — offline shell, nothing clever.
//
// Pages (navigations): network first, so a new deploy is always picked up;
// the last good copy is the fallback when offline.
// Hashed build assets (/assets/*): cache first — the hash changes with the
// content, so a cached copy is never stale.
// Icons and the manifest: stale-while-revalidate.
// /api/* and every cross-origin request: never touched — live data and AI
// calls must not be served from a cache the app does not know about. The
// app keeps its own labelled caches for data (localStorage), which is what
// it shows when offline.

const VERSION = 'maddex-sw-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192x192.png', '/icons/favicon-32x32.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('/', copy)); return res })
        .catch(() => caches.match('/')),
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)) }
        return res
      })),
    )
    return
  }

  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)) } return res }).catch(() => hit)
        return hit ?? net
      }),
    )
  }
})
