import { PAL } from '../styles/palette.js'
// Corporate actions and new listings — dated, sourced, hand-entered.
//
// Every row is from a company's published financial calendar or notice of
// meeting, or from the ASX's "Upcoming floats and listings" page, and carries
// that source. Nothing is filled in to make a category look busy: where no
// capital raising, SPP or split has been announced and checked, the tracker
// says so. Companies move these dates — they are INDICATIVE until the day, and
// each row links to where to confirm it.
//
// Collected 2026-10-27; re-read from each company's own calendar or notice
// and the ASX floats page on 2026-11-16 (rows that could not be re-read were
// removed: WMC, JRL and S88 are no longer on the ASX page; MTX withdrew).
// Refresh: bank calendars after each result; the ASX
// floats page weekly (it covers only the next four to six weeks).

export const CORPORATE_ACTIONS_AS_OF = '2026-11-16'

export const ACTION_TYPES = [
  { key: 'dividend', label: 'DIVIDENDS', short: 'EX-DIV', colour: PAL.up },
  { key: 'results', label: 'RESULTS', short: 'RESULT', colour: PAL.gold },
  { key: 'agm', label: 'AGMs', short: 'AGM', colour: PAL.dim },
  { key: 'raising', label: 'RAISINGS / SPPs', short: 'RAISING', colour: '#B07CC6' },
  { key: 'split', label: 'SPLITS', short: 'SPLIT', colour: '#5B9BD5' },
  { key: 'listing', label: 'LISTINGS', short: 'LISTING', colour: '#D08A3C' },
]

const WBC = { source: 'Westpac financial calendar', sourceUrl: 'https://www.westpac.com.au/about-westpac/investor-centre/financial-information/financial-calendar/' }
const NAB = { source: 'NAB financial calendar', sourceUrl: 'https://www.nab.com.au/about-us/shareholder-centre/financial-calendar' }
const ANZ = { source: 'ANZ financial calendar', sourceUrl: 'https://www.anz.com/shareholder/centre/calendar-events/financial-calendar/' }

export const CORPORATE_ACTIONS = [
  { date: '2026-10-29', type: 'agm', ticker: 'WES.AX', company: 'Wesfarmers', detail: '2026 Annual General Meeting.', source: 'Wesfarmers notice of meeting', sourceUrl: 'https://www.wesfarmers.com.au/docs/default-source/asx-announcements/2026-notice-of-annual-general-meeting-20260904005623.pdf' },
  { date: '2026-10-29', type: 'agm', ticker: 'WOW.AX', company: 'Woolworths Group', detail: '2026 Annual General Meeting.', source: 'Woolworths notice, 17 Aug 2026', sourceUrl: 'https://www.woolworthsgroup.com.au/au/en/investors.html' },
  { date: '2026-11-02', type: 'results', ticker: 'WBC.AX', company: 'Westpac', detail: 'Full-year results and final dividend announcement (year to 30 Sep).', ...WBC },
  { date: '2026-11-05', type: 'dividend', ticker: 'WBC.AX', company: 'Westpac', detail: 'Ex-dividend date for the final dividend. Record date 6 Nov; payable 21 Dec.', ...WBC },
  { date: '2026-11-05', type: 'results', ticker: 'NAB.AX', company: 'National Australia Bank', detail: 'Full-year results announcement (year to 30 Sep).', ...NAB },
  { date: '2026-11-06', type: 'agm', ticker: 'NEC.AX', company: 'Nine Entertainment', detail: '2026 Annual General Meeting.', source: 'Nine Entertainment FY26 annual report', sourceUrl: 'https://www.nineforbrands.com.au/investors/' },
  { date: '2026-11-09', type: 'results', ticker: 'ANZ.AX', company: 'ANZ Group', detail: 'Full-year results and investor presentation.', ...ANZ },
  { date: '2026-11-10', type: 'dividend', ticker: 'NAB.AX', company: 'National Australia Bank', detail: 'Ex-dividend date for the final dividend. Record date 11 Nov; payable 15 Dec.', ...NAB },
  { date: '2026-11-12', type: 'dividend', ticker: 'ANZ.AX', company: 'ANZ Group', detail: 'Ex-dividend date for the final dividend. Record date 13 Nov; payable 18 Dec.', ...ANZ },
  { date: '2026-11-18', type: 'agm', ticker: 'IGO.AX', company: 'IGO Limited', detail: '2026 Annual General Meeting.', source: 'IGO annual general meeting page', sourceUrl: 'https://www.igo.com.au/site/investor-center/agm' },
  { date: '2026-12-10', type: 'agm', ticker: 'NAB.AX', company: 'National Australia Bank', detail: '2026 Annual General Meeting.', ...NAB },
  { date: '2026-12-16', type: 'agm', ticker: 'WBC.AX', company: 'Westpac', detail: 'Annual General Meeting. Location and agenda in the November notice of meeting.', ...WBC },
  { date: '2026-12-17', type: 'agm', ticker: 'ANZ.AX', company: 'ANZ Group', detail: 'Annual General Meeting (Perth).', ...ANZ },
]

// The ASX "Upcoming floats and listings" page, read 2026-11-16. Status is
// UPCOMING while the proposed date is ahead; once it passes the row says the
// date has passed rather than claiming the company listed — that needs
// checking against the ASX, not assuming.
const ASX_FLOATS = { source: 'ASX upcoming floats and listings', sourceUrl: 'https://www.asx.com.au/listings/upcoming-floats-and-listings' }

export const ASX_LISTINGS = [
  { code: 'CX8', company: 'Capability X', sector: null, date: '2026-11-12', raiseAud: 12_000_000, price: 0.20, note: 'Not underwritten', ...ASX_FLOATS },
  { code: 'MAV', company: 'Maverick Uranium', sector: 'Uranium', date: null, raiseAud: 7_500_000, price: 0.20, note: 'Listing date TBA on the ASX page (it was 12 Nov)', ...ASX_FLOATS },
  { code: 'RDO', company: 'Rio de Oro Corp', sector: 'Resources', date: '2026-11-30', raiseAud: 30_000_000, price: 0.40, note: 'Not underwritten', ...ASX_FLOATS },
  { code: 'MBM', company: 'M Battery Materials', sector: 'Battery materials', date: '2026-12-02', raiseAud: 25_000_000, price: 0.50, note: 'Not underwritten', ...ASX_FLOATS },
]

export function listingStatus(l, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })) {
  if (!l.date) return 'TBA'
  return l.date >= today ? 'UPCOMING' : 'DATE PASSED'
}
