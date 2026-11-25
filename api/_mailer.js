// The email sender the waitlist endpoint uses (api/waitlist.js), behind one
// interface so the provider can be chosen and set up separately:
//
//   mailer.send({ to, subject, text, html, headers }) → Promise<{ id? }>
//
// It must throw (or reject) when the message was not accepted for delivery.
// `headers` carries List-Unsubscribe and List-Unsubscribe-Post (RFC 8058);
// the provider must pass them through. The sender's name and address, and
// the physical address Australia's Spam Act asks for, are the provider
// set-up's to add.
//
// No sender is configured in this repository (26 Nov 2026): configuredMailer()
// returns null, and the endpoint then answers 503 not_configured without
// sending anything. To connect one, return an object with send() from
// configuredMailer(), reading its key from a server-only environment variable
// (never VITE_).

export function configuredMailer() {
  return null
}

// For tests: records each message instead of sending it.
export function mockMailer({ fail = false } = {}) {
  const sent = []
  return {
    sent,
    async send(msg) {
      if (fail) throw new Error('mock mailer: refused')
      sent.push(msg)
      return { id: `mock-${sent.length}` }
    },
  }
}
