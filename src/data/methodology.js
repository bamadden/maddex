// How each score in the terminal is built — the text behind every
// ScoreNote's "How it's calculated". One entry per measure, so a method is
// described once and the same words appear wherever the score does.
//
// Every score here is a DESCRIPTIVE measure of data that has already been
// published or observed. None is a forecast, a rating or a recommendation,
// and each entry says what it is not.

import { RUBRIC } from './recessionRisk'

export const METHODS = {
  sentiment: {
    name: 'Market sentiment score',
    what: 'A 0–100 summary of how markets moved over the last session. 50 is balanced; higher means more prices rose, lower means more fell.',
    how: [
      'ASX breadth — share of 72 tracked ASX stocks that rose (weight 20)',
      'ASX momentum — their average daily % change, scaled (weight 15)',
      'S&P 500 daily % change, scaled (weight 15)',
      'Bitcoin daily % change, scaled (weight 12)',
      'Crypto Fear & Greed index, as published by alternative.me (weight 12)',
      'Crypto breadth — share of tracked coins that rose (weight 8)',
      'Missing inputs are left out, never counted as 0% or 50, and the weights re-normalised over the rest. With no inputs there is no score.',
    ],
    not: 'It describes what has happened. It does not predict what markets will do and is not a signal to buy or sell. While no licensed equity feed is connected, the ASX and S&P 500 inputs (50 of the 82 weight points) are simulated DEMO prices, so the score is a demo composite and is badged DEMO wherever it appears.',
  },
  outlook: {
    name: 'MaddenAI outlook (words)',
    what: 'MaddenAI\'s one-word description of the tone of the morning\'s news and data.',
    how: ['Written by the model from the figures supplied to it in the brief.', 'It is words only: the model never gives a score.'],
    not: 'A description of tone, not a view on any investment.',
  },
  regime: {
    name: 'Market regime',
    what: 'A label for the current macro backdrop, from published ABS and RBA figures.',
    how: [
      'Policy: the direction of the RBA\'s last move within nine months.',
      'Slowing: GDP below its 2.25% trend, or unemployment up 0.2 points or more over six months.',
      'Inflation: CPI against the RBA\'s 2–3% target band.',
      'Each quarter is classified with the same rules on that quarter\'s published data.',
    ],
    not: 'A description of published data, not a forecast of the economy or markets.',
  },
  recession: {
    name: 'Recession risk rubric',
    what: 'A 0–100 points score of how many recession warning signs are present in published data. Higher means more signs.',
    how: [...RUBRIC.map(([factor, pts]) => `${factor} — up to ${pts} points`), 'Each input is a verified ABS/RBA figure or a sourced yield-curve point, shown with its date.'],
    not: 'Maddex\'s own rubric, not a probability of recession and not a forecast.',
  },
  diversification: {
    name: 'Diversification score',
    what: 'How differently the listed holdings have moved: 100 minus the average absolute correlation between each pair, times 100.',
    how: ['Pairwise correlation of daily returns over the selected period.', 'ASX holdings only.'],
    not: 'A description of past co-movement. It says nothing about what to buy, sell or hold.',
  },
  'crypto-momentum': {
    name: 'Crypto momentum index',
    what: 'A 0–100 summary of how the tracked coins moved over 24 hours and 7 days, weighted by market cap, with breadth and the Fear & Greed index.',
    how: ['24h and 7d % changes, scaled and market-cap weighted.', 'Share of tracked coins that rose.', 'Crypto Fear & Greed index (alternative.me).'],
    not: 'A description of recent price moves, not a forecast or a signal.',
  },
  'country-risk': {
    name: 'Geopolitical risk index',
    what: 'Maddex\'s own editorial index: each score is the sum of documented, dated rubric factors (data/geopoliticalRisk.js), not a vendor measure.',
    how: ['Each factor and its points are listed on the panel.'],
    not: 'A description of published conditions, not a forecast or an investment view.',
  },
  'momentum-scan': {
    name: 'Momentum scan score',
    what: 'A weighted blend of each stock\'s price change over three windows, in percent: higher means it rose more.',
    how: ['50% of the 5-day change, 30% of the 10-day, 20% of the 20-day.', 'Closing prices only; ranked highest first, top 20 shown.'],
    not: 'A description of past price moves, not a forecast or a signal.',
  },
  'sector-strength': {
    name: 'Sector strength composite',
    what: 'A 0–100 summary of how one representative stock per sector is trading today.',
    how: [
      'Day move: 50 plus ten times the day\'s % change, held between 0 and 100 (weight 4 of 7).',
      'Range position: where the price sits between its 52-week low (0) and high (100) (weight 3 of 7).',
      'If one part is missing the other is used alone; with neither, the sector shows no score.',
    ],
    not: 'A description of today\'s trading in one stock per sector, not a view on the sector.',
  },
  'macro-regime': {
    name: 'Macro regime read',
    what: 'A label for the macro setting. MaddenAI writes it from the published figures passed to it (cash rates, CPI, GDP, unemployment); while that is unavailable, Maddex\'s own editorial reading is shown.',
    how: ['The figures come from verified RBA, ABS and Fed releases, never from the model.', 'The label and its wording are judgement, marked AI or editorial in the panel.'],
    not: 'A description of published conditions, not a forecast or an investment view.',
  },
  'screen-match': {
    name: 'Screen match',
    what: 'How far a stock clears the thresholds of the screen you set, scaled 50–100: 50 means it just qualifies.',
    how: ['Each active criterion is scored for how far past its threshold the stock is, then averaged.'],
    not: 'A measure of fit to your own criteria, not a rating of the stock.',
  },
}
