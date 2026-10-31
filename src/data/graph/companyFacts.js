// Company facts from each company's ASX profile (asx.com.au/markets/company/<TICKER>),
// read 31 Oct 2026: the company's own business description, ASX listing date,
// website, registered office and the S&P/ASX indices ASX lists it in.
// DISCLOSED — stated by the exchange and the company, carried as stated.
// Generated from the saved profiles; refresh by re-reading them, not by hand.
//
// Facts not here (revenue, profit, employees, financial year end…) are shown
// as NOT YET SOURCED on the company profile — never estimated.

export const FACTS_AS_OF = '2026-10-31'
export const factsSource = (ticker) => ({ label: `ASX company profile — ${ticker}`, url: `https://www.asx.com.au/markets/company/${ticker}`, date: FACTS_AS_OF })

// The ASX index codes the graph models as nodes.
export const INDEX_CODE = { XTL: 'idx:asx20', XJO: 'idx:asx200', XKO: 'idx:asx300' }

export const COMPANY_FACTS = {
  "BHP": {
    "description": "BHP Group Limited (BHP) is a diversified natural resources company. The company's assets, operations and interests include iron ore, copper, metallurgical coal, nickel and potash.",
    "listed": "1885-08-13",
    "website": "http://bhp.com",
    "office": "Level 18, 171 Collins Street, MELBOURNE, VIC, AUSTRALIA, 3000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XFL",
      "XJO",
      "XKO",
      "XMJ",
      "XMM",
      "XTL",
      "XTO"
    ]
  },
  "CBA": {
    "description": "Banking, financial and related services.",
    "listed": "1991-09-12",
    "website": "http://www.commbank.com.au/",
    "office": "Commonwealth Bank of Australia, Commonwealth Bank Place South, Level 1, 11 Harbour Street, Sydney, NSW, AUSTRALIA, 2000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XDI",
      "XFJ",
      "XFL",
      "XJO",
      "XKO",
      "XTL",
      "XTO",
      "XXJ"
    ]
  },
  "NAB": {
    "description": "Banking, financial and related services.",
    "listed": "1962-01-31",
    "website": "http://www.nabgroup.com",
    "office": "Level 28, 395 BOURKE STREET, MELBOURNE, VIC, AUSTRALIA, 3000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XDI",
      "XFJ",
      "XFL",
      "XJO",
      "XKO",
      "XTL",
      "XTO",
      "XXJ"
    ]
  },
  "WBC": {
    "description": "Banking, financial and related services.",
    "listed": "1970-07-18",
    "website": "http://www.westpac.com.au",
    "office": "C/- Group Secretariat, Level 18, 275 Kent Street, SYDNEY, NSW, AUSTRALIA, 2000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XDI",
      "XFJ",
      "XFL",
      "XJO",
      "XKO",
      "XTL",
      "XTO",
      "XXJ"
    ]
  },
  "ANZ": {
    "description": "ANZ provides banking and financial products and services to individual and business customers.",
    "listed": "1969-09-30",
    "website": "http://www.anz.com.au/",
    "office": "ANZ Centre Melbourne, Level 9, 833 Collins Street, DOCKLANDS, VIC, AUSTRALIA, 3008",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XDI",
      "XFJ",
      "XFL",
      "XJO",
      "XKO",
      "XTL",
      "XTO",
      "XXJ"
    ]
  },
  "MQG": {
    "description": "Non-operating holding company for consolidated entity - financial services provider of banking, financial, advisory, investment and funds management services.",
    "listed": "2007-11-05",
    "website": "http://www.macquarie.com",
    "office": "Level 1, 1 Elizabeth Street, SYDNEY, NSW, AUSTRALIA, 2000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XFJ",
      "XFL",
      "XJO",
      "XKO",
      "XTL",
      "XTO",
      "XXJ"
    ]
  },
  "CSL": {
    "description": "Development, manufacturing and marketing of pharmaceutical and diagnostic products, cell culture media and human plasma fractions.",
    "listed": "1994-06-08",
    "website": "http://www.csl.com.au/",
    "office": "655 Elizabeth Street, Melbourne, VIC, AUSTRALIA, 3000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XFL",
      "XHJ",
      "XJO",
      "XKO",
      "XTL",
      "XTO"
    ]
  },
  "WES": {
    "description": "Diversified industrial with interests including retail operations covering home improvement and office supplies; general merchandise and specialty departments stores, gas processing and distribution; chemicals and fertilisers; and industrial and safety p",
    "listed": "1984-11-15",
    "website": "http://www.wesfarmers.com.au",
    "office": "Level 14, Brookfield Place Tower 2, 123 St Georges Terrace, PERTH, WA, AUSTRALIA, 6000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XDI",
      "XDJ",
      "XFL",
      "XJO",
      "XKO",
      "XTL",
      "XTO"
    ]
  },
  "XYZ": {
    "description": "Block is a global fintech company. It builds tools that aim to empower businesses and individuals to participate in the economy.",
    "listed": "2022-01-20",
    "website": "https://block.xyz",
    "office": "Tower One - International Towers Sydney, Level 46, 100 Barangaroo Avenue, Barangaroo, NSW, AUSTRALIA, 2000",
    "indices": [
      "XAO",
      "XAT",
      "XFJ",
      "XJO",
      "XKO",
      "XMD",
      "XTO",
      "XXJ"
    ]
  },
  "WDS": {
    "description": "Woodside Energy Group Ltd is Australia's largest energy company with a focus on the exploration, development, production and the sale of oil, natural gas, liquefied natural gas (LNG) and new energy. Woodside has a diverse portfolio, with LNG, oil, gas and new energy assets and interests in Australia, the United States, Trinidad and Tobago, Senegal, Mexico and Timor-Leste.",
    "listed": "1971-11-18",
    "website": "https://www.woodside.com/",
    "office": "Mia Yellagonga, 11 Mount Street, PERTH, WA, AUSTRALIA, 6000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XEJ",
      "XFL",
      "XJO",
      "XKO",
      "XTL",
      "XTO"
    ]
  },
  "GMG": {
    "description": "Goodman Group is a provider of essential infrastructure. We own, develop and manage high quality, sustainable logistics properties and data centres in major global cities, that are critical to the digital economy.",
    "listed": "2005-02-02",
    "website": "http://www.goodman.com",
    "office": "The Hayesbery, 1-11 Hayes Road, Rosebery, NSW, AUSTRALIA, 2018",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XFL",
      "XJO",
      "XKO",
      "XPJ",
      "XTL",
      "XTO"
    ]
  },
  "RIO": {
    "description": "Rio Tinto operates in 35 countries where 60,000 employees are working to find better ways to provide the materials the world needs. Our portfolio includes iron ore, copper, aluminium and other minerals and materials needed for the energy transition.",
    "listed": "1962-09-19",
    "website": "http://www.riotinto.com",
    "office": "Level 43, 120 Collins Street, MELBOURNE, VIC, AUSTRALIA, 3000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XFL",
      "XJO",
      "XKO",
      "XMJ",
      "XMM",
      "XTL",
      "XTO"
    ]
  },
  "TLS": {
    "description": "Telecommunications Carrier. Provision of telecommunications and information services, including mobiles, internet, and pay television.",
    "listed": "1997-11-17",
    "website": "http://www.telstra.com.au/",
    "office": "Level 41 - Telstra Centre, 242 Exhibition Street, MELBOURNE, VIC, AUSTRALIA, 3000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XDI",
      "XFL",
      "XJO",
      "XKO",
      "XTJ",
      "XTL",
      "XTO"
    ]
  },
  "RMD": {
    "description": "Medical device manufacturing",
    "listed": "1999-11-25",
    "website": "http://www.resmed.com",
    "office": "9001 Spectrum Center Blvd, SAN DIEGO, CA, UNITED STATES OF AMERICA, 92123",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XFL",
      "XHJ",
      "XJO",
      "XKO",
      "XTO"
    ]
  },
  "WOW": {
    "description": "Food, general merchandise and specialty retailing through chain store operations",
    "listed": "1993-07-12",
    "website": "http://woolworthsgroup.com.au",
    "office": "1 Woolworths Way, BELLA VISTA, NSW, AUSTRALIA, 2153",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XFL",
      "XJO",
      "XKO",
      "XSJ",
      "XTL",
      "XTO"
    ]
  },
  "FMG": {
    "description": "Fortescue is the technology, energy and metals group accelerating the commercial decarbonisation of industry, rapidly, profitably and globally.",
    "listed": "1987-03-19",
    "website": "http://www.fortescue.com",
    "office": "Ground Floor, 256 St Georges Terrace, Perth, WA, AUSTRALIA, 6000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XFL",
      "XJO",
      "XKO",
      "XMJ",
      "XMM",
      "XTL",
      "XTO"
    ]
  },
  "TCL": {
    "description": "Owner, operator and developer of electronic toll roads and intelligent transport systems.",
    "listed": "1996-03-14",
    "website": "http://www.transurban.com.au/",
    "office": "Level 31, Tower 5, Collins Square, 727 Collins Street, DOCKLANDS, VIC, AUSTRALIA, 3008",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XDI",
      "XFL",
      "XJO",
      "XKO",
      "XNJ",
      "XTL",
      "XTO"
    ]
  },
  "QBE": {
    "description": "Underwriting general and reinsurance risks, investment management and management of the economic entity's share of the NSW and Victorian workers' compensation scheme.",
    "listed": "1973-06-28",
    "website": "http://www.qbe.com",
    "office": "Level 18, 388 George Street, SYDNEY, NSW, AUSTRALIA, 2000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XDI",
      "XFJ",
      "XFL",
      "XJO",
      "XKO",
      "XTL",
      "XTO",
      "XXJ"
    ]
  },
  "ALL": {
    "description": "Designs, develops, manufactures and markets a diverse range of products and services including electronic gaming machines, casino management systems, free-to-play mobile games, and online real money games.",
    "listed": "1996-07-09",
    "website": "http://www.aristocrat.com",
    "office": "Building A, Pinnacle Office Park, 85 Epping Road, NORTH RYDE, NSW, AUSTRALIA, 2113",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XDJ",
      "XFL",
      "XJO",
      "XKO",
      "XTL",
      "XTO"
    ]
  },
  "NST": {
    "description": "Northern Star is a global-scale gold producer with three high-quality production centres: Kalgoorlie, Yandal and Pogo, and a development project, Hemi, located in low sovereign risk jurisdictions of Western Australia and Alaska.",
    "listed": "2003-12-17",
    "website": "http://www.nsrltd.com",
    "office": "Level 4, 500 Hay Street, SUBIACO, WA, AUSTRALIA, 6008",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XFL",
      "XGD",
      "XJO",
      "XKO",
      "XMJ",
      "XMM",
      "XTL",
      "XTO"
    ]
  },
  "COL": {
    "description": "Australian retailer of products such as fresh food, groceries, household goods, liquor, fuel and financial services via stores and online",
    "listed": "2018-11-21",
    "website": "http://www.colesgroup.com.au/",
    "office": "800 Toorak Road, Hawthorn East, VIC, AUSTRALIA, 3123",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XDI",
      "XFL",
      "XJO",
      "XKO",
      "XSJ",
      "XTL",
      "XTO"
    ]
  },
  "BXB": {
    "description": "Brambles is a supply-chain logistics company operating in more than 60 countries. Brambles operates primarily through the CHEP brand and manages the world's largest pool of reusable pallets, crates and containers.",
    "listed": "2006-11-27",
    "website": "http://www.brambles.com",
    "office": "Level 29, 255 George Street, SYDNEY, NSW, AUSTRALIA, 2000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XFL",
      "XJO",
      "XKO",
      "XNJ",
      "XTL",
      "XTO"
    ]
  },
  "STO": {
    "description": "Gas and petroleum exploration and the production, treatment and marketing of natural gas, crude oil, condensate, naphtha and liquid petroleum gas; transportation by pipeline of crude oil.",
    "listed": "1954-10-01",
    "website": "http://www.santos.com",
    "office": "Ground Floor Santos Centre, 60 Flinders Street, ADELAIDE, SA, AUSTRALIA, 5000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XDI",
      "XEJ",
      "XFL",
      "XJO",
      "XKO",
      "XTO"
    ]
  },
  "EVN": {
    "description": "Gold mining",
    "listed": "2002-08-20",
    "website": "http://www.evolutionmining.com",
    "office": "Level 26, 85 Castlereagh Street, Sydney, NSW, AUSTRALIA, 2000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XFL",
      "XGD",
      "XJO",
      "XKO",
      "XMJ",
      "XMM",
      "XTO"
    ]
  },
  "PLS": {
    "description": "Lithium and tantalum producer and explorer",
    "listed": "2007-09-19",
    "website": "http://www.pilbaraminerals.com.au",
    "office": "Level 2, 146 Colin Street, West Perth, WA, AUSTRALIA, 6005",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XFL",
      "XJO",
      "XKO",
      "XMJ",
      "XMM",
      "XTO"
    ]
  },
  "ORG": {
    "description": "Operating energy businesses",
    "listed": "1961-07-13",
    "website": "http://www.originenergy.com.au/",
    "office": "Level 32, Tower 1, 100 Barangaroo Avenue, SYDNEY, NSW, AUSTRALIA, 2000",
    "indices": [
      "XAF",
      "XAO",
      "XAT",
      "XDI",
      "XFL",
      "XJO",
      "XKO",
      "XTO",
      "XUJ"
    ]
  },
  "BWP": {
    "description": "Warehouse retailing properties, in particular, Bunnings Warehouses.",
    "listed": "1998-09-16",
    "website": "http://www.bwptrust.com.au",
    "office": "Level 14, Brookfield Place Tower 2, 123 St Georges Terrace, PERTH, WA, AUSTRALIA, 6000",
    "indices": [
      "XAO",
      "XAT",
      "XJO",
      "XKO",
      "XPJ",
      "XSO"
    ]
  },
  "PPT": {
    "description": "Trustees, executors, investment managers, funds management, investment administration, custody and registry services.",
    "listed": "1964-06-24",
    "website": "http://www.perpetual.com.au",
    "office": "Level 14, Angel Place, 123 Pitt Street, SYDNEY, NSW, AUSTRALIA, 2000",
    "indices": [
      "XAO",
      "XAT",
      "XFJ",
      "XJO",
      "XKO",
      "XSO",
      "XXJ"
    ]
  },
  "LIC": {
    "description": "Creating and managing affordable communities which offer homeowners a whole new way of living.",
    "listed": "1998-12-15",
    "website": "http://www.lifestylecommunities.com.au",
    "office": "Suite 2.02 Level 2, 68 Clarke Street, Southbank, VIC, AUSTRALIA, 3006",
    "indices": [
      "XAO",
      "XKO",
      "XSO"
    ]
  },
  "ACL": {
    "description": "Provision of pathology services",
    "listed": "2021-05-14",
    "website": "https://www.clinicallabs.com.au/",
    "office": "1868-1892 Dandenong Road, Clayton, VIC, AUSTRALIA, 3168",
    "indices": [
      "XAO",
      "XEC",
      "XKO",
      "XSO"
    ]
  },
  "MAG": {
    "description": "Gold and copper exploration.",
    "listed": "2017-05-19",
    "website": "http://www.magmaticresources.com",
    "office": "Suite 5 CPC, 145 Stirling Highway, Nedlands, WA, AUSTRALIA, 6009",
    "indices": []
  }
}
