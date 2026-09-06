// ASX-listed tickers, without the .AX suffix.
//
// This lives in its own module because two unrelated things need it: the news
// scanner (which highlights tickers it recognises in headlines) and the quote
// guard (which catches an ASX ticker being priced off the wrong exchange).
// It used to exist only as a commented block inside api.js's TICKER_WHITELIST,
// where the ASX, US and crypto names share one flat Set — readable by a person
// but not separable by code, so the guard could not reuse it.
//
// Not exhaustive; roughly the ASX 100 plus names this app references. A ticker
// missing from here means the guard stays quiet about it, not that anything
// breaks.
export const ASX_TICKERS = new Set([
  'BHP', 'CBA', 'CSL', 'WOW', 'ANZ', 'NAB', 'WBC', 'MQG', 'RIO', 'TLS', 'FMG', 'WES', 'GMG',
  'ALL', 'MIN', 'WDS', 'XRO', 'REA', 'COL', 'TCL', 'QBE', 'SHL', 'IAG', 'MPL', 'ORG', 'APA',
  'ASX', 'BXB', 'CPU', 'DXS', 'EVN', 'GPT', 'JHX', 'LLC', 'MGR', 'NCM', 'NST', 'ORI', 'PLS',
  'RMD', 'SGP', 'SUN', 'TAH', 'TWE', 'AMC', 'AMP', 'ANN', 'APE', 'ARB', 'AUB', 'AWC', 'BAP',
  'BEN', 'BOQ', 'BSL', 'CAR', 'CGF', 'CHC', 'COH', 'CTD', 'CWY', 'DMP', 'EBO', 'ELD', 'FLT',
  'GUD', 'HVN', 'IFL', 'IGO', 'ILU', 'JBH', 'LOV', 'LYC', 'MFG', 'MND', 'MPB', 'MTS', 'NEM',
  'SKI', 'STO', 'VCX', 'WHC', 'WPR',
])

// A handful of these codes are also live tickers on a US exchange — NEM is
// Newmont on the NYSE, SUN is SunCoke. The guard treats a match as a question
// ("did you mean .AX?"), never as an error, precisely because of these.
export const isASXStock = (symbol) =>
  ASX_TICKERS.has(String(symbol ?? '').toUpperCase().replace(/\.AX$/, ''))
