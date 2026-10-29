// Trial email sequence — the templates.
//
// TODO(resend): nothing sends these yet. They are rendered by the server-side
// sender described in docs/TRIAL_EMAILS.md once RESEND_API_KEY is set and the
// scheduled job is enabled. Until then this file is the copy, reviewable and
// testable on its own.
//
// Each template takes the reader's own facts — name, days left, what they have
// used — and returns { subject, html, text }. Prices and plan limits come from
// services/plans, so an email cannot promise what a plan does not give.
//
// The three emails:
//   1. Day 1, 7pm Sydney  — "Your Maddex terminal is ready": three things to try
//   2. Day 4              — "3 days left in your Maddex trial": used / changes
//   3. Day 7              — "Your Maddex trial ends tomorrow": the decision

import { PRICES, LIMITS } from './plans'

const SITE = 'https://maddex.vercel.app'
const FOOTER = 'Maddex · General information only — not financial advice. You are receiving this because you started a Maddex trial.'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// One shell for all three: dark, gold accent, a single call to action.
function shell({ preheader, heading, paragraphs, list, cta }) {
  const items = (list ?? []).map((l) => `<tr><td style="padding:3px 0;color:${l.tone ?? '#E8EDF5'};font-size:14px">${esc(l.mark ?? '•')}&nbsp; ${esc(l.text)}</td></tr>`).join('')
  const html = `<!doctype html><html><body style="margin:0;background:#060D1A;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#060D1A"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0B1628;border:1px solid rgba(201,168,76,0.45)">
<tr><td style="padding:28px 32px 8px;font-family:Menlo,monospace;color:#C9A84C;font-size:13px;letter-spacing:3px;font-weight:700">MADDEX</td></tr>
<tr><td style="padding:8px 32px 0;color:#FFFFFF;font-size:22px;font-weight:700">${esc(heading)}</td></tr>
${paragraphs.map((p) => `<tr><td style="padding:12px 32px 0;color:#C8D3E0;font-size:15px;line-height:1.55">${esc(p)}</td></tr>`).join('')}
${items ? `<tr><td style="padding:12px 32px 0"><table cellpadding="0" cellspacing="0">${items}</table></td></tr>` : ''}
<tr><td style="padding:24px 32px 28px"><a href="${esc(cta.href)}" style="display:inline-block;background:#C9A84C;color:#060D1A;text-decoration:none;font-weight:700;letter-spacing:2px;font-size:13px;padding:12px 20px">${esc(cta.label)}</a></td></tr>
</table>
<div style="max-width:560px;color:#4A6080;font-size:11px;line-height:1.5;padding:14px 8px">${esc(FOOTER)}</div>
</td></tr></table></body></html>`
  const text = [heading, '', ...paragraphs, ...(list ?? []).map((l) => `${l.mark ?? '•'} ${l.text}`), '', `${cta.label}: ${cta.href}`, '', FOOTER].join('\n')
  return { html, text }
}

const hello = (name) => (name ? `Hi ${name},` : 'Hi,')

export function welcomeEmail({ firstName } = {}) {
  const subject = 'Your Maddex terminal is ready'
  return {
    subject,
    ...shell({
      preheader: 'Three things to try in your first week.',
      heading: subject,
      paragraphs: [hello(firstName), 'Your trial has full Apex access for seven days. Three things worth trying this week:'],
      list: [
        { mark: '1', text: 'Add five stocks to your watchlist — the daily digest and alerts are written around them.' },
        { mark: '2', text: 'Ask MaddenAI how the next RBA decision affects your holdings (press A anywhere).' },
        { mark: '3', text: 'Open the morning brief at 7am — the day\'s markets in two minutes.' },
      ],
      cta: { label: 'OPEN YOUR TERMINAL', href: SITE },
    }),
  }
}

// used: { briefs, aiQuestions, researchNotes, alerts, holdings }
export function midTrialEmail({ firstName, used = {}, daysLeft = 3 } = {}) {
  const subject = `${daysLeft} days left in your Maddex trial`
  const usedList = [
    used.briefs ? { mark: '✓', tone: '#2D8A50', text: `${used.briefs} morning brief${used.briefs === 1 ? '' : 's'}` } : null,
    used.aiQuestions ? { mark: '✓', tone: '#2D8A50', text: `${used.aiQuestions} MaddenAI question${used.aiQuestions === 1 ? '' : 's'}` } : null,
    used.researchNotes ? { mark: '✓', tone: '#2D8A50', text: `${used.researchNotes} research note${used.researchNotes === 1 ? '' : 's'}` } : null,
    used.alerts ? { mark: '✓', tone: '#2D8A50', text: `${used.alerts} price alert${used.alerts === 1 ? '' : 's'}` } : null,
  ].filter(Boolean)
  return {
    subject,
    ...shell({
      preheader: 'What you have used so far, and what changes on Core.',
      heading: subject,
      paragraphs: [
        hello(firstName),
        usedList.length ? 'So far you have used:' : 'You have not tried much of Maddex yet — there are three days to change that.',
      ],
      list: [
        ...usedList,
        { mark: '✗', tone: '#CC4444', text: `On Core after the trial: MaddenAI drops to ${LIMITS.core.aiPerDay} questions a day; portfolio tracking, price alerts, the scanner and research notes are not included.` },
      ],
      cta: { label: `UPGRADE NOW — A$${PRICES.prime.monthly}/MONTH`, href: `${SITE}/?upgrade=prime` },
    }),
  }
}

export function lastDayEmail({ firstName, used = {} } = {}) {
  const subject = 'Your Maddex trial ends tomorrow'
  const specific = used.holdings
    ? `Your ${used.holdings} portfolio holding${used.holdings === 1 ? '' : 's'} stay saved, but the analysis — rate impact, dividends, the daily digest — needs Prime.`
    : used.alerts
      ? `Your ${used.alerts} price alert${used.alerts === 1 ? '' : 's'} stay saved but stop firing on Core.`
      : 'Your watchlist stays, and Core stays free.'
  return {
    subject,
    ...shell({
      preheader: 'Keep everything you set up — or carry on free on Core.',
      heading: subject,
      paragraphs: [
        hello(firstName),
        'Tomorrow your account moves to Core, the free plan. Nothing is deleted.',
        specific,
        `Prime is A$${PRICES.prime.monthly} a month: portfolio, ${LIMITS.prime.alerts} price alerts, the scanner, ${LIMITS.prime.researchNotesPerMonth} research notes a month and ${LIMITS.prime.aiPerDay} MaddenAI questions a day.`,
      ],
      cta: { label: `UPGRADE TO PRIME — A$${PRICES.prime.monthly}/MO`, href: `${SITE}/?upgrade=prime` },
    }),
  }
}

export const TRIAL_EMAILS = [
  { id: 'welcome', day: 1, at: '19:00', build: welcomeEmail },
  { id: 'mid', day: 4, at: '09:00', build: midTrialEmail },
  { id: 'last', day: 7, at: '09:00', build: lastDayEmail },
]
