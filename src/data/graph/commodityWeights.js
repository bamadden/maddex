// Commodity revenue shares for the S&P/ASX 20 producers, from each latest
// annual report's segment or revenue note, read 31 Oct 2026.
//
// A share of revenue is a division, so the report never prints it as such.
// Each entry carries both inputs — numerator and denominator — with the
// table row each was read from and its page, and the weight is their ratio
// to one decimal place. A build script refused any input whose quote was not
// on its page of the extracted report, or whose number was not in its quote;
// schema.js and the tests re-check the arithmetic.
//
// Keyed '<TICKER>|<commodity node>'. Producers or commodities not here stay
// INFERRED, with no weight.

export const COMMODITY_WEIGHTS = 
{
  "BHP|cmd:copper": {
    "weight": 49.4,
    "basis": "Copper segment revenue ÷ group revenue, FY2026",
    "numerator": {
      "value": 29031.0,
      "quote": "Revenue 29,031 22,530",
      "page": 32
    },
    "denominator": {
      "value": 58760.0,
      "quote": "Revenue 58,760 51,262",
      "page": 20
    },
    "source": {
      "label": "BHP Annual Report 2026 p32",
      "url": "https://announcements.asx.com.au/asxpdf/20260818/pdf/072vxpfhmy9lfk.pdf#page=32",
      "date": "2026-06-30"
    }
  },
  "BHP|cmd:iron-ore": {
    "weight": 40.6,
    "basis": "Iron Ore segment revenue ÷ group revenue, FY2026",
    "numerator": {
      "value": 23883.0,
      "quote": "Revenue 23,883 22,919",
      "page": 33
    },
    "denominator": {
      "value": 58760.0,
      "quote": "Revenue 58,760 51,262",
      "page": 20
    },
    "source": {
      "label": "BHP Annual Report 2026 p33",
      "url": "https://announcements.asx.com.au/asxpdf/20260818/pdf/072vxpfhmy9lfk.pdf#page=33",
      "date": "2026-06-30"
    }
  },
  "RIO|cmd:iron-ore": {
    "weightLabel": "% of segment revenue",
    "weightTip": "Rio Tinto's Iron Ore product group segmental revenue as a share of its reportable segments total (Iron Ore, Aluminium & Lithium, Copper), 2025. Segmental revenue includes Rio's share of equity-accounted units, so this is not a share of consolidated sales revenue.",
    "weight": 48.5,
    "basis": "Iron Ore segmental revenue ÷ reportable segments total, 2025 (segmental revenue includes share of equity-accounted units)",
    "numerator": {
      "value": 28989.0,
      "quote": "Iron Ore 28,989 31,601 34,539",
      "page": 172
    },
    "denominator": {
      "value": 59774.0,
      "quote": "Reportable segments total 59,774 54,526 53,502",
      "page": 172
    },
    "source": {
      "label": "Rio Tinto Annual Report 2025 p172",
      "url": "https://www.riotinto.com/-/media/content/documents/invest/reports/annual-reports/2025-annual-report.pdf#page=172",
      "date": "2025-12-31"
    }
  },
  "RIO|cmd:copper": {
    "weightLabel": "% of segment revenue",
    "weightTip": "Rio Tinto's Copper product group segmental revenue as a share of its reportable segments total (Iron Ore, Aluminium & Lithium, Copper), 2025. Segmental revenue includes Rio's share of equity-accounted units, so this is not a share of consolidated sales revenue.",
    "weight": 23.0,
    "basis": "Copper segmental revenue ÷ reportable segments total, 2025 (segmental revenue includes share of equity-accounted units)",
    "numerator": {
      "value": 13729.0,
      "quote": "Copper 13,729 9,275 6,678",
      "page": 172
    },
    "denominator": {
      "value": 59774.0,
      "quote": "Reportable segments total 59,774 54,526 53,502",
      "page": 172
    },
    "source": {
      "label": "Rio Tinto Annual Report 2025 p172",
      "url": "https://www.riotinto.com/-/media/content/documents/invest/reports/annual-reports/2025-annual-report.pdf#page=172",
      "date": "2025-12-31"
    }
  },
  "FMG|cmd:iron-ore": {
    "weightLabel": "% of segment revenue",
    "weightTip": "Total iron ore revenue as a share of the Metals segment's operating sales revenue (iron ore, shipping and other revenue), FY2026. Fortescue's Energy segment is not in the base.",
    "weight": 88.9,
    "basis": "Total iron ore revenue ÷ Metals segment operating sales revenue, FY2026",
    "numerator": {
      "value": 14966.0,
      "quote": "otal iron ore revenue, US$ millions 3 14,966 13,935",
      "page": 41
    },
    "denominator": {
      "value": 16830.0,
      "quote": "Operating sales revenue, US$ millions 16,830 15,460",
      "page": 41
    },
    "source": {
      "label": "Fortescue FY26 Annual Report p41",
      "url": "https://content.fortescue.com/fortescue17114-fortescueeb60-productionbbdb-8be5/media/project/fortescueportal/shared/documents/regulatory/asx-announcements/fy26-annual-report_-app4e_updated.pdf#page=41",
      "date": "2026-06-30"
    }
  },
  "WDS|cmd:lng": {
    "weight": 45.9,
    "basis": "LNG revenue ÷ consolidated operating revenue, 2025",
    "numerator": {
      "value": 5960.0,
      "quote": "Liquified natural gas 4,800 — 1,160 — 5,960",
      "page": 190
    },
    "denominator": {
      "value": 12984.0,
      "quote": "Operating revenue2 7,501 4,069 1,414 — 12,984",
      "page": 190
    },
    "source": {
      "label": "Woodside 2025 Annual Report p190",
      "url": "https://announcements.asx.com.au/asxpdf/20260224/pdf/06wnjpjvgshc5z.pdf#page=190",
      "date": "2025-12-31"
    }
  },
  "WDS|cmd:oil": {
    "weight": 40.5,
    "basis": "Crude oil and condensate revenue ÷ consolidated operating revenue, 2025",
    "numerator": {
      "value": 5257.0,
      "quote": "Crude oil and condensate 1,313 3,872 72 — 5,257",
      "page": 190
    },
    "denominator": {
      "value": 12984.0,
      "quote": "Operating revenue2 7,501 4,069 1,414 — 12,984",
      "page": 190
    },
    "source": {
      "label": "Woodside 2025 Annual Report p190",
      "url": "https://announcements.asx.com.au/asxpdf/20260224/pdf/06wnjpjvgshc5z.pdf#page=190",
      "date": "2025-12-31"
    }
  },
  "NST|cmd:gold": {
    "weight": 99.6,
    "basis": "Sale of gold ÷ total revenue, FY2026",
    "numerator": {
      "value": 7591.8,
      "quote": "Sale of gold 7,591.8 6,402.9",
      "page": 150
    },
    "denominator": {
      "value": 7623.1,
      "quote": "Total revenue 7,623.1 6,414.9",
      "page": 150
    },
    "source": {
      "label": "Northern Star FY26 Annual Report p150",
      "url": "https://announcements.asx.com.au/asxpdf/20260820/pdf/072yrj41k9b95z.pdf#page=150",
      "date": "2026-06-30"
    }
  }
}
