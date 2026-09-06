import { askClaudeJSON } from './api'

// Hardcoded coverage universe, per the brief's exact prompt.
export const PORTFOLIO_BUILDER_UNIVERSE = [
  'BHP', 'CBA', 'CSL', 'WBC', 'NAB', 'ANZ', 'WES', 'MQG', 'WOW', 'RIO',
  'FMG', 'TLS', 'GMG', 'QBE', 'COL', 'ALL', 'TCL', 'WTC', 'XRO', 'REA',
]

export async function generatePortfolio(userInput) {
  // The prompt asks for allocations and reasoning, not dollars.
  //
  // It used to request totalBudget, suggestedUnits, estimatedCost and
  // expectedYield. None of those could be real: the model has no price for
  // any of these stocks and no dividend data, so the unit counts and costs
  // were fabricated — and the modal fed estimatedCost/units straight into the
  // user's actual portfolio as avgCost, giving every imported holding a made-up
  // purchase price that all its subsequent P&L was measured against.
  // expectedYield was worse still: a specific promised return on a portfolio
  // the model invented.
  //
  // Percentage allocations are the one quantitative thing a model CAN produce
  // here — they are a judgement about weighting, not a claim about the market —
  // so those stay. Everything denominated in dollars is gone.
  const prompt = `The investor wants to build a portfolio with these criteria: "${userInput}"

Available ASX stocks (from our coverage):
${PORTFOLIO_BUILDER_UNIVERSE.join(', ')}

CONSTRAINTS:
- You have NO price, dividend, yield or market data for any of these stocks. Do not state or estimate a price, a dollar amount, a number of units, a cost, or a yield. Not even approximately.
- Allocations are percentages of the portfolio and must sum to 1.0. That is the only quantitative output you may produce.
- Do not promise or project a return. No expected yield, no target return, no "should deliver around X".
- Rationales are qualitative: what role the holding plays in the portfolio and why it suits the stated criteria.

Return a suggested allocation as JSON:
{
  "summary": "one paragraph explaining the shape of the portfolio and how it meets the criteria",
  "holdings": [
    {
      "symbol": "BHP.AX",
      "name": "BHP Group",
      "allocation": 0.25,
      "rationale": "one sentence on the role this plays — no figures"
    }
  ],
  "incomeCharacter": "the income profile in words, e.g. 'weighted toward established dividend payers' or 'growth-oriented, limited income' — never a yield figure",
  "riskProfile": "CONSERVATIVE" | "BALANCED" | "GROWTH" | "AGGRESSIVE",
  "diversificationNote": "one sentence on sector and factor spread",
  "disclaimer": "General information only. Not financial advice. This is a suggested allocation, not a recommendation to buy, and it contains no price, cost or yield estimates — size any position from live market data."
}
Return ONLY valid JSON.`

  return askClaudeJSON(prompt, { maxTokens: 1500 })
}
