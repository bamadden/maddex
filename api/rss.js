// RSS → JSON proxy.
//
// Feeds do not send CORS headers, so a browser cannot read them directly.
// The app previously went through api.rss2json.com, a free third-party
// service: every user's news request passed through an unaffiliated server
// that could see it, rate-limit it, or change what came back. For a feed
// that drives sentiment scoring and a notification badge, that is a lot of
// trust to place in a host nobody chose.
//
// This does the same job in our own request path. One handler, used by the
// Vercel function in production and by a Vite middleware in dev (see
// vite.config.js), so there is one parser to be correct rather than two.

// Only these hosts are proxied. Without an allowlist this endpoint is an
// open proxy: anyone could point it at an internal address and read the
// response through our origin.
const ALLOWED_HOSTS = [
  'afr.com', 'smh.com.au', 'rba.gov.au', 'abc.net.au',
  'reuters.com', 'feeds.reuters.com', 'cnbc.com', 'marketwatch.com',
  'feeds.marketwatch.com', 'finance.yahoo.com', 'yahoo.com', 'investing.com',
  'bbci.co.uk', 'feeds.bbci.co.uk', 'theguardian.com', 'economist.com',
  'cointelegraph.com', 'coindesk.com', 'oilprice.com', 'mining.com',
]

const hostAllowed = (host) =>
  ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))

// Entity decoding. Feeds are inconsistent about escaping — the same
// publisher will send &amp;amp; in one item and a raw ampersand in the next —
// so this runs twice to catch double-encoded text.
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&#39;': "'", '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
  '&lsquo;': '‘', '&rsquo;': '’', '&ldquo;': '“', '&rdquo;': '”',
}

function decode(str) {
  if (!str) return ''
  let out = str
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
  }
  return out
}

// Pulls one tag's text. Handles CDATA, which most feeds wrap titles in, and
// attributes on the opening tag, which Atom's <link href> needs.
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  if (!m) return ''
  const raw = m[1].trim()
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/)
  return decode((cdata ? cdata[1] : raw).trim())
}

function attr(block, name, key) {
  const m = block.match(new RegExp(`<${name}[^>]*\\s${key}=["']([^"']+)["']`, 'i'))
  return m ? decode(m[1]) : ''
}

const stripHtml = (s) => decode(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

// Handles RSS <item> and Atom <entry> in one pass — several of the
// configured feeds are Atom, and treating them as RSS silently yields zero
// items rather than an error.
export function parseFeed(xml) {
  const blocks = [
    ...(xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? []),
  ]

  return blocks.map((b) => {
    const link = tag(b, 'link') || attr(b, 'link', 'href')
    const body = tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded') || tag(b, 'content')
    return {
      title: stripHtml(tag(b, 'title')),
      link,
      pubDate: tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date') || '',
      description: stripHtml(body).slice(0, 400),
      author: tag(b, 'dc:creator') || tag(b, 'author'),
    }
  }).filter((i) => i.title)
}

export default async function handler(req, res) {
  const raw = (req.query?.url) ?? new URL(req.url, 'http://localhost').searchParams.get('url')
  if (!raw) return res.status(400).json({ error: 'Missing url parameter' })

  let target
  try { target = new URL(raw) } catch { return res.status(400).json({ error: 'Invalid url' }) }
  if (!/^https?:$/.test(target.protocol)) return res.status(400).json({ error: 'Unsupported protocol' })
  if (!hostAllowed(target.hostname)) return res.status(403).json({ error: `Host not allowed: ${target.hostname}` })

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        // Several publishers return 403 to a request with no User-Agent.
        'User-Agent': 'Mozilla/5.0 (compatible; MaddexTerminal/1.0; +https://maddex.com.au)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!upstream.ok) return res.status(502).json({ error: `Upstream ${upstream.status}`, items: [] })

    const xml = await upstream.text()
    const items = parseFeed(xml)

    // Feeds change slowly; caching at the edge keeps a page refresh from
    // re-fetching nineteen of them.
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800')
    return res.status(200).json({ status: 'ok', count: items.length, items })
  } catch (err) {
    return res.status(502).json({ error: err.message, items: [] })
  }
}
