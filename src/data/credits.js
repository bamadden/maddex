// The attribution each source's terms require, in their own words where they
// give them (docs/DATA_SOURCES.md). Shown next to the data.

export const CREDIT = {
  coingecko: { text: 'Powered by CoinGecko', url: 'https://www.coingecko.com' },
  alternativeme: { text: 'Data from alternative.me', url: 'https://alternative.me/crypto/fear-and-greed-index/' },
  ecb: { text: 'Source: European Central Bank (via Frankfurter)', url: 'https://www.ecb.europa.eu' },
  exchangerateapi: { text: 'Rates By Exchange Rate API', url: 'https://www.exchangerate-api.com' },
  rba: { text: 'Source: Reserve Bank of Australia', url: 'https://www.rba.gov.au' },
  abs: { text: 'Source: Australian Bureau of Statistics (CC BY 4.0)', url: 'https://www.abs.gov.au' },
  usgs: { text: 'Credit: U.S. Geological Survey', url: 'https://earthquake.usgs.gov' },
}

// RBA terms: charging for access must not hide that the data is published
// free by the RBA. The same courtesy for the ABS and ECB.
export const FREE_DATA_NOTICE = 'RBA, ABS and ECB figures are published free of charge by those agencies; a Maddex subscription pays for the terminal, not for their data.'
