// Terms, Privacy and Disclaimer — served from the app itself.
//
// These existed as links before they existed as pages. AuthModal, NavBar and
// Settings all pointed at an absolute URL on maddex.com.au; that domain
// serves nothing, and vercel.json rewrites every non-/api path to index.html,
// so each of those links resolved to this app's own 404. A user was being asked
// to agree to terms they could not read.
//
// BEFORE LAUNCH: these are written from the way the product actually behaves,
// not from a template, but they have not been reviewed by a lawyer and the
// company's ABN/ACN is not stated because it is not recorded anywhere in this
// codebase and inventing one would be worse than omitting it. Both need doing.

export const COMPANY = 'Madden Group Holdings Pty Ltd'
export const CONTACT = 'ben@maddex.com.au'
export const EFFECTIVE = '7 September 2026'

// ─── Documents ───────────────────────────────────────────────────────────────
//
// Each is a list of { heading, body[] }. Kept as data rather than JSX so all
// three render through one component and cannot drift apart in styling.

const DISCLAIMER = {
  slug: 'disclaimer',
  title: 'Disclaimer',
  lede: 'Maddex gives you information and analysis. It does not tell you what to do with your money.',
  sections: [
    {
      heading: 'General information only',
      body: [
        `Everything published in the Maddex terminal — market data, charts, screens, research notes, calendars, and anything written by MaddenAI — is general information. It does not take into account your objectives, your financial situation or your needs.`,
        `${COMPANY} does not hold an Australian Financial Services Licence and does not provide financial product advice, personal advice, or a recommendation to buy, hold or sell any financial product. Nothing in the terminal should be read as one.`,
        `Before acting on anything you read here, consider whether it is appropriate for you, read the relevant product disclosure statement, and — if you need advice — speak to someone licensed to give it.`,
      ],
    },
    {
      heading: 'Some prices in the terminal are demonstration data',
      body: [
        `Equity and index prices are currently served from a clearly labelled demonstration dataset while live market data is being connected. Wherever that is the case the terminal says DEMO on the surface showing it.`,
        `Demonstration prices move and look real. They are not. Do not use them to value a holding, size a position, or make any decision about a real trade.`,
        `Other feeds — foreign exchange, RBA statistics, crypto, on-chain and DeFi figures, seismic and news data — come from live third-party sources named on the surface that displays them.`,
      ],
    },
    {
      heading: 'MaddenAI',
      body: [
        `MaddenAI is a large language model. It writes commentary and explanation from figures the terminal passes to it. It can be wrong, it can misread context, and it does not know anything the terminal has not given it.`,
        `Treat its output as a starting point for your own work, never as a finding. Verify any figure that matters against its source before you rely on it.`,
      ],
    },
    {
      heading: 'Past performance',
      body: [
        `Past performance is not a reliable indicator of future performance. Nothing shown in a chart, backtest, comparison or scenario in this terminal forecasts a return.`,
      ],
    },
    {
      heading: 'Third-party data',
      body: [
        `The terminal displays data from third parties. ${COMPANY} does not warrant that any of it is accurate, complete, current or fit for any purpose, and is not responsible for errors or omissions in it or for delays or interruptions in its delivery.`,
      ],
    },
  ],
}

const TERMS = {
  slug: 'terms',
  title: 'Terms of Service',
  lede: `These terms govern your use of the Maddex terminal, operated by ${COMPANY}.`,
  sections: [
    {
      heading: '1. Agreement',
      body: [
        `By creating an account or using Maddex you agree to these terms. If you do not agree, do not use the service.`,
        `You must be at least 18 years old and legally able to enter into a contract.`,
      ],
    },
    {
      heading: '2. What Maddex is',
      body: [
        `Maddex is a financial information and analysis terminal. It is an information service, not a broker, not a market operator, and not a financial adviser. It does not execute trades, hold money, or hold financial products on your behalf.`,
        `Read the Disclaimer. It forms part of these terms.`,
      ],
    },
    {
      heading: '3. Your account',
      body: [
        `You are responsible for your login credentials and for everything done through your account. Tell us at ${CONTACT} promptly if you believe your account has been accessed without your authority.`,
        `One account is for one person. Do not share it.`,
      ],
    },
    {
      heading: '4. Trial and subscription',
      body: [
        `New accounts receive a free trial with full Apex access for the trial period stated at sign-up. When the trial ends, access to paid features stops unless you subscribe.`,
        `Subscriptions are billed in advance at the price shown at the time you subscribe, in Australian dollars, and renew automatically for successive periods until cancelled. You may cancel at any time; cancellation takes effect at the end of the period you have paid for.`,
        `Fees already paid are not refunded on cancellation, except where a refund is required by the Australian Consumer Law or where we choose to give one.`,
        `We may change prices. If we do, we will give you notice before the change applies to your next renewal.`,
      ],
    },
    {
      heading: '5. Acceptable use',
      body: [
        `Do not scrape, redistribute, resell or republish data obtained through Maddex; reverse engineer the service; circumvent access controls or usage limits; use the service to break the law; or use it in a way that degrades it for other users.`,
        `Data displayed in Maddex is licensed to us by third parties for display to you. It does not become yours to redistribute.`,
      ],
    },
    {
      heading: '6. Your content',
      body: [
        `Your watchlists, portfolio entries, notes and research notes remain yours. You grant us the licence needed to store, process and display them so the service can work.`,
        `Some of this data is stored only in your own browser. Clearing your browser storage deletes it, and we cannot recover it.`,
      ],
    },
    {
      heading: '7. Availability',
      body: [
        `We aim to keep Maddex available but do not guarantee uninterrupted access. The service depends on third-party data providers and infrastructure, and may be unavailable during maintenance, outages or events outside our control.`,
      ],
    },
    {
      heading: '8. Liability',
      body: [
        `Our goods and services come with guarantees that cannot be excluded under the Australian Consumer Law. Nothing in these terms excludes, restricts or modifies those rights.`,
        `Subject to that, and to the maximum extent permitted by law: Maddex is provided "as is"; we exclude all other warranties; and we are not liable for any trading or investment loss, loss of profit, or indirect or consequential loss arising from your use of the service.`,
        `Where our liability can be limited but not excluded, it is limited to resupplying the service or paying the cost of resupply, at our election, and in any case to the total amount you paid us in the twelve months before the claim.`,
      ],
    },
    {
      heading: '9. Suspension and termination',
      body: [
        `We may suspend or terminate an account that breaches these terms. You may close your account at any time from Settings or by contacting ${CONTACT}.`,
      ],
    },
    {
      heading: '10. Changes',
      body: [
        `We may update these terms. Material changes will be notified in the terminal or by email before they take effect. Continuing to use Maddex after that means you accept the updated terms.`,
      ],
    },
    {
      heading: '11. Governing law',
      body: [
        `These terms are governed by the laws of Queensland, Australia. You and ${COMPANY} submit to the non-exclusive jurisdiction of the courts of Queensland and the courts able to hear appeals from them.`,
      ],
    },
    {
      heading: '12. Contact',
      body: [`Questions about these terms: ${CONTACT}.`],
    },
  ],
}

const PRIVACY = {
  slug: 'privacy',
  title: 'Privacy Policy',
  lede: `How ${COMPANY} handles your personal information, in line with the Privacy Act 1988 (Cth) and the Australian Privacy Principles.`,
  sections: [
    {
      heading: 'What we collect',
      body: [
        `Account details you give us: first and last name, email address, and country.`,
        `Subscription details: your plan, trial status and billing status. Card details are handled by our payment processor and are never stored by us.`,
        `Usage data needed to run the service: sign-in times, and application error reports.`,
        `Content you create: watchlists, portfolio holdings, alerts, notes and research notes. Much of this is stored only in your browser and never reaches us.`,
      ],
    },
    {
      heading: 'What we do with it',
      body: [
        `We use your information to provide the terminal, authenticate you, apply your subscription, respond to support requests, and keep the service secure and working.`,
        `We do not sell your personal information, and we do not use it for third-party advertising.`,
      ],
    },
    {
      heading: 'Stored in your browser',
      body: [
        `Maddex deliberately keeps a lot on your own device rather than on a server: your watchlist, portfolio, alerts, notification history, layout and preferences. That data stays in your browser's local storage.`,
        `It is not sent to us, it does not follow you to another device, and clearing your browser data removes it permanently.`,
      ],
    },
    {
      heading: 'Who else is involved',
      body: [
        `Authentication and account storage: Supabase. Hosting and delivery: Vercel. AI commentary: Anthropic — the terminal sends the question and the figures shown on screen, and does not send your name, email or account identifiers.`,
        `Market, economic and on-chain data providers, each named on the surface that displays their data.`,
        `Some of these providers process data outside Australia, including in the United States.`,
      ],
    },
    {
      heading: 'Security',
      body: [
        `Access is authenticated, traffic is encrypted in transit, and account data is held in managed infrastructure with access restricted to what is needed to operate the service. No system is perfectly secure, and we cannot guarantee absolute security.`,
      ],
    },
    {
      heading: 'Access, correction and deletion',
      body: [
        `You can view and correct your profile in Settings at any time. To request a copy of the personal information we hold about you, or to have your account and its data deleted, email ${CONTACT}.`,
      ],
    },
    {
      heading: 'Complaints',
      body: [
        `If you believe we have mishandled your personal information, contact us first at ${CONTACT} and we will respond. If you are not satisfied with our response, you can complain to the Office of the Australian Information Commissioner at oaic.gov.au.`,
      ],
    },
    {
      heading: 'Changes',
      body: [`We may update this policy. The effective date below reflects the current version.`],
    },
  ],
}

export const LEGAL_DOCS = { terms: TERMS, privacy: PRIVACY, disclaimer: DISCLAIMER }
