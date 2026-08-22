// Vercel serverless function — proxies Claude API calls so the Anthropic
// key never ships in the client bundle. ANTHROPIC_API_KEY (no VITE_ prefix)
// must be set in the Vercel project's environment variables; a non-prefixed
// var is never exposed to client code, unlike VITE_-prefixed ones.

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
        system,
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
      return res.status(200).json(data)
    }

    // Default: pipe Anthropic's SSE stream straight through — the client's
    // askClaude() already parses this exact event-stream format.
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const reader = anthropicRes.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
    return res.end()
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(500).json({ error: err.message })
  }
}
