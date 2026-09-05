// Vercel serverless function — proxies Claude API calls so the Anthropic
// key never ships in the client bundle. ANTHROPIC_API_KEY (no VITE_ prefix)
// must be set in the Vercel project's environment variables; a non-prefixed
// var is never exposed to client code, unlike VITE_-prefixed ones.
//
// Prompt caching: a plain-string `system` is wrapped into a single text block
// carrying cache_control, so every caller gets its system prompt cached with
// no per-call-site opt-in. Callers that need finer placement may pass `system`
// as an already-formed block array and it is forwarded untouched.
//
// Caching is GA — it needs no anthropic-beta header. (The old
// `prompt-caching-2024-07-31` header is a no-op on current models.)
// Note: the cache has a model-dependent MINIMUM cacheable prefix — 1024
// tokens on claude-sonnet-4-6. A shorter system prompt is silently not
// cached: no error, just cache_creation_input_tokens: 0 forever.

// Marks the system prompt as a cache breakpoint. Volatile per-request content
// (dates, watchlists, prices) must live in the messages array, after this
// breakpoint — anything that changes byte-for-byte inside the cached prefix
// invalidates the entry on every call.
function buildSystem(system) {
  if (!system) return undefined
  if (Array.isArray(system)) return system
  return [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
}

function logCacheStats(usage) {
  if (!usage) return
  console.log('[CLAUDE CACHE STATS]', {
    cached_read:    usage.cache_read_input_tokens     || 0,
    cached_created: usage.cache_creation_input_tokens || 0,
    uncached:       usage.input_tokens                || 0,
    output:         usage.output_tokens               || 0,
  })
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages, system, max_tokens, model, stream } = req.body

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type':       'application/json',
        'x-api-key':          process.env.ANTHROPIC_API_KEY,
        'anthropic-version':  '2023-06-01',
      },
      body: JSON.stringify({
        model:      model || 'claude-sonnet-4-6',
        max_tokens: max_tokens || 1024,
        system:     buildSystem(system),
        messages,
        stream:     stream !== false,
      }),
    })

    res.setHeader('Access-Control-Allow-Origin', '*')

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      return res.status(anthropicRes.status).json({ error: errText })
    }

    // Non-streaming callers (stream: false) get the plain JSON response back.
    if (stream === false) {
      const data = await anthropicRes.json()
      logCacheStats(data.usage)
      return res.status(200).json(data)
    }

    // Default: pipe Anthropic's SSE stream straight through — the client's
    // askClaude() already parses this exact event-stream format.
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const reader  = anthropicRes.body.getReader()
    const decoder = new TextDecoder()
    let sniffed   = false
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // Forward bytes untouched; decode a copy only to surface cache stats,
      // which ride on the message_start event at the head of the stream.
      if (!sniffed) {
        const chunk = decoder.decode(value, { stream: true })
        const line  = chunk.split('\n').find((l) => l.startsWith('data: ') && l.includes('message_start'))
        if (line) {
          sniffed = true
          try { logCacheStats(JSON.parse(line.slice(6)).message?.usage) } catch {}
        }
      }
      res.write(value)
    }
    return res.end()
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(500).json({ error: err.message })
  }
}
