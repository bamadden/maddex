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

// Second breakpoint: the end of the conversation history.
//
// Marked on the LAST ASSISTANT message, not the last message overall. The
// final user turn carries a per-turn [CONTEXT] prefix (date, module, open
// asset) and changes every call, so a breakpoint there would never be read
// back. Everything up to and including the previous assistant reply is
// byte-stable — AIPanel stores clean text in chatMessages and only the
// transient wire copy carries the context prefix — so that prefix matches on
// the next turn and the whole history is served from cache.
//
// Requests with no assistant message (the one-shot JSON services) get no
// second breakpoint, which is correct: there is no history to reuse.
//
// Cache lookups match the longest cached prefix regardless of where the
// CURRENT request places its breakpoints, so each turn writing a new entry
// one message further along still reads the previous turn's entry.
function withHistoryCache(messages) {
  if (!Array.isArray(messages) || messages.length < 2) return messages
  let idx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') { idx = i; break }
  }
  if (idx === -1) return messages

  const target = messages[idx]
  const blocks = typeof target.content === 'string'
    ? (target.content.trim() ? [{ type: 'text', text: target.content }] : null)
    : Array.isArray(target.content) && target.content.length
      ? target.content
      : null
  // An empty assistant turn (the streaming placeholder) has no cacheable
  // block — an empty text block is rejected by the API.
  if (!blocks) return messages

  return messages.map((m, i) => (
    i === idx
      ? { ...m, content: blocks.map((b, j) => (
          j === blocks.length - 1 ? { ...b, cache_control: { type: 'ephemeral' } } : b
        )) }
      : m
  ))
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
        messages:   withHistoryCache(messages),
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
