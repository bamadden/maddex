import { askClaudeJSON } from './api'

// Hardcoded coverage universe, per the brief's exact prompt.
export const PORTFOLIO_BUILDER_UNIVERSE = [
  'BHP', 'CBA', 'CSL', 'WBC', 'NAB', 'ANZ', 'WES', 'MQG', 'WOW', 'RIO',
  'FMG', 'TLS', 'GMG', 'QBE', 'COL', 'ALL', 'TCL', 'WTC', 'XRO', 'REA',
]

export async function generatePortfolio(userInput) {
  const prompt = `The investor wants to build a portfolio with these criteria: "${userInput}"

Available ASX stocks (from our coverage):
${PORTFOLIO_BUILDER_UNIVERSE.join(', ')}

Return a suggested portfolio as JSON:
{
  "summary": "one paragraph explaining the portfolio",
  "totalBudget": number,
  "holdings": [
    {
      "symbol": "BHP.AX",
      "name": "BHP Group",
      "allocation": 0.25,
      "rationale": "one sentence",
      "suggestedUnits": number,
      "estimatedCost": number
    }
  ],
  "expectedYield": number,
  "riskProfile": "CONSERVATIVE" | "BALANCED" | "GROWTH" | "AGGRESSIVE",
  "disclaimer": "General information only. Not financial advice. This is a suggested allocation only."
}
Return ONLY valid JSON.`

  return askClaudeJSON(prompt, { maxTokens: 1500 })
}
