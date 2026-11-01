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

import { COMPANY, CONTACT } from './company'
import { FREE_DATA_NOTICE } from './credits'
export { COMPANY, CONTACT }
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
        `Sources include: crypto prices powered by CoinGecko; the Crypto Fear & Greed Index from alternative.me; FX reference rates from the European Central Bank (via Frankfurter) and rates by Exchange Rate API; statistics from the Reserve Bank of Australia and the Australian Bureau of Statistics (CC BY 4.0); earthquake data credit U.S. Geological Survey; map data © OpenStreetMap contributors © CARTO; headlines from ABC News, BBC News, Yahoo Finance and the RBA, each linked to its publisher. Each surface names the source of what it shows.`,
        `${FREE_DATA_NOTICE} Third-party providers do not endorse Maddex.`,
      ],
    },
  ],
}

const TERMS = {
  slug: 'terms',
  title: 'Terms of Use',
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

// The data inventory below is checked against the code (legal-risk pass,
// item 7): the Supabase tables in supabase/migrations, the browser keys in
// services/accountData LOCAL_PREFIXES, and every server function in api/.
// Change it when any of those change.
const PRIVACY = {
  slug: 'privacy',
  title: 'Privacy Policy',
  lede: `How ${COMPANY} handles your personal information, in line with the Privacy Act 1988 (Cth) and the Australian Privacy Principles. DRAFT, pending legal review.`,
  sections: [
    {
      heading: 'What we collect, and where it is kept',
      body: [
        `Account: your email address, first and last name, country and time zone — stored with our authentication and database provider (Supabase). With it we keep records of your consents (the version of these terms and of the Disclaimer you accepted, and when) and your onboarding progress.`,
        `Portfolio and watchlist: when you are signed in, your holdings (ticker, units, average cost, currency, date added) and watchlist are stored in your account so they follow you between devices. A copy is also kept in your browser.`,
        `Alerts and notes: price alerts and saved research notes are stored in your account. Transactions you record, your investor profile (reading level, interests, risk tolerance and time horizon), layouts and preferences are kept in your browser only.`,
        `AI usage: for each MaddenAI request we record the time, the model, whether it was a chat question, and the number of tokens used — to apply your plan's daily limits. We also keep a record of each AI reply (see "MaddenAI").`,
        `Waitlist and newsletter: your email address, if you join.`,
        `Share links: if you create one, the link's id and the snapshot it shows (for a portfolio, percentages only).`,
        `Error reports are kept in your browser and are not sent to us.`,
      ],
    },
    {
      heading: 'MaddenAI',
      body: [
        `When you ask MaddenAI a question, your question and the context the terminal adds — the date, the module you are on, any asset you have open, your watchlist, your holdings by ticker and weight, and your reading level and interests — are sent through our server to Anthropic, which provides the model. Your name, email address and account identifiers are not sent to Anthropic. Your risk tolerance and time horizon are never sent.`,
        `Maddex does not store your questions. We keep a record of each reply — the reply text, the model, the version of our instructions, the date of the data it was given, and the result of our automated check for recommendation language — so that we can investigate a complaint. That record is linked to your account.`,
      ],
    },
    {
      heading: 'What we do with it',
      body: [
        `We use your information to provide the terminal, authenticate you, apply your plan, send the alerts and newsletters you ask for, respond to support requests and complaints, and keep the service secure and working.`,
        `We do not sell your personal information, and we do not use it for advertising. Maddex uses no analytics or advertising trackers.`,
      ],
    },
    {
      heading: 'Who else receives it',
      body: [
        `Supabase — authentication and database (your account, portfolio, watchlist, alerts, notes, usage and AI reply records).`,
        `Vercel — hosting, and the server functions your requests pass through (including MaddenAI requests). Vercel keeps request logs as part of running the service.`,
        `Anthropic — the AI model, which receives MaddenAI requests as described above, under its commercial terms.`,
        `Resend — delivers alert emails and newsletters to your email address, if you turn them on.`,
        `Market, economic, news and map providers named in the terminal receive requests from your browser or our server when data is fetched. They see the request and your IP address, not your account.`,
        `Some of these providers process data outside Australia, including in the United States.`,
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        `Account, portfolio, watchlist, alerts and notes: until you delete them or your account.`,
        `AI usage records: 90 days. AI reply records: 2 years, for complaint handling (this period is under legal review).`,
        `Waitlist and newsletter: until you unsubscribe or delete your account.`,
        `Data in your browser: until you clear it, delete your account, or use Clear all cached data in Settings.`,
      ],
    },
    {
      heading: 'Security',
      body: [
        `Access is authenticated, traffic is encrypted in transit, each user's rows are protected by row-level security, and service keys are held only on our servers. No system is perfectly secure, and we cannot guarantee absolute security. If a breach is likely to cause you serious harm we will tell you and the Office of the Australian Information Commissioner, as the Notifiable Data Breaches scheme requires.`,
      ],
    },
    {
      heading: 'Access, correction and deletion',
      body: [
        `Settings → Data → Export my data downloads everything we hold about you as one file. You can correct your profile in Settings at any time.`,
        `Settings → Delete account deletes your account and all of its data, including your login, and clears Maddex data from that browser. You can also email ${CONTACT}.`,
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
      body: [`We may update this policy. The effective date and version above reflect the current one; if a change is significant we will ask you to accept it again.`],
    },
  ],
}

export const LEGAL_DOCS = { terms: TERMS, privacy: PRIVACY, disclaimer: DISCLAIMER }
