// Key facts for the ten largest S&P/ASX 20 companies, read from each latest
// annual report on 31 Oct 2026. Every value carries the sentence or table
// row it was read from, its page and the report's balance date.
//
// Built by a script that refused any value whose quote was not found on its
// page of the extracted report text, or whose numbers were not inside the
// quote — nothing here is recalled or estimated. Banks report operating
// income, not revenue; the note on each says which line was used.
//
// fields: fye (financial year end), revenue, profit (net profit after tax,
// attributable), employees, auditor. A missing field shows NOT YET SOURCED.
// revenue.measure 'operating income' marks the banks and Macquarie, whose
// figure is a net income line, not gross revenue — the profile labels it so.

export const KEY_FACTS_READ = '2026-10-31'

export const KEY_FACTS = 
{
  "BHP": {
    "fye": {
      "value": "30 June",
      "quote": "year ended 30 June 2026",
      "page": 1,
      "note": null,
      "source": {
        "label": "BHP Annual Report 2026 p1",
        "url": "https://announcements.asx.com.au/asxpdf/20260818/pdf/072vxpfhmy9lfk.pdf#page=1",
        "date": "2026-06-30"
      }
    },
    "revenue": {
      "value": "US$58,760m",
      "quote": "Revenue 58,760 51,262",
      "page": 20,
      "note": "Consolidated income statement, FY2026.",
      "source": {
        "label": "BHP Annual Report 2026 p20",
        "url": "https://announcements.asx.com.au/asxpdf/20260818/pdf/072vxpfhmy9lfk.pdf#page=20",
        "date": "2026-06-30"
      }
    },
    "profit": {
      "value": "US$9,833m",
      "quote": "Profit/(loss) after taxation attributable to BHP shareholders 9,833 9,019",
      "page": 20,
      "note": "Attributable to BHP shareholders.",
      "source": {
        "label": "BHP Annual Report 2026 p20",
        "url": "https://announcements.asx.com.au/asxpdf/20260818/pdf/072vxpfhmy9lfk.pdf#page=20",
        "date": "2026-06-30"
      }
    },
    "employees": {
      "value": "40,863",
      "quote": "Total 40,863 23,913 16,950 58.5 41.5",
      "page": 231,
      "note": "Employees at 30 June 2026 (Table 3), excluding contractors.",
      "source": {
        "label": "BHP Annual Report 2026 p231",
        "url": "https://announcements.asx.com.au/asxpdf/20260818/pdf/072vxpfhmy9lfk.pdf#page=231",
        "date": "2026-06-30"
      }
    },
    "auditor": {
      "value": "Ernst & Young",
      "quote": "Independent auditor’s report to the members of BHP Group Limited A member firm of Ernst & Young Global Limited",
      "page": 97,
      "note": null,
      "source": {
        "label": "BHP Annual Report 2026 p97",
        "url": "https://announcements.asx.com.au/asxpdf/20260818/pdf/072vxpfhmy9lfk.pdf#page=97",
        "date": "2026-06-30"
      }
    }
  },
  "CBA": {
    "fye": {
      "value": "30 June",
      "quote": "year ended 30 June 2026",
      "page": 2,
      "note": null,
      "source": {
        "label": "CBA 2026 Annual Report p2",
        "url": "https://announcements.asx.com.au/asxpdf/20260812/pdf/072nfthfnhfmbx.pdf#page=2",
        "date": "2026-06-30"
      }
    },
    "revenue": {
      "measure": "operating income",
      "value": "A$30,224m",
      "quote": "Total operating income 30,224 28,465",
      "page": 44,
      "note": "Total operating income, cash basis (banks report operating income, not revenue).",
      "source": {
        "label": "CBA 2026 Annual Report p44",
        "url": "https://announcements.asx.com.au/asxpdf/20260812/pdf/072nfthfnhfmbx.pdf#page=44",
        "date": "2026-06-30"
      }
    },
    "profit": {
      "value": "A$10,911m",
      "quote": "Statutory NPAT $10,911m",
      "page": 44,
      "note": "Statutory net profit after tax.",
      "source": {
        "label": "CBA 2026 Annual Report p44",
        "url": "https://announcements.asx.com.au/asxpdf/20260812/pdf/072nfthfnhfmbx.pdf#page=44",
        "date": "2026-06-30"
      }
    },
    "employees": {
      "value": "55,000+",
      "quote": "55,000+ employees",
      "page": 12,
      "note": "As stated; rounded.",
      "source": {
        "label": "CBA 2026 Annual Report p12",
        "url": "https://announcements.asx.com.au/asxpdf/20260812/pdf/072nfthfnhfmbx.pdf#page=12",
        "date": "2026-06-30"
      }
    },
    "auditor": {
      "value": "PricewaterhouseCoopers",
      "quote": "Independent auditor’s report To the members of the Commonwealth Bank of Australia PricewaterhouseCoopers",
      "page": 334,
      "note": null,
      "source": {
        "label": "CBA 2026 Annual Report p334",
        "url": "https://announcements.asx.com.au/asxpdf/20260812/pdf/072nfthfnhfmbx.pdf#page=334",
        "date": "2026-06-30"
      }
    }
  },
  "NAB": {
    "fye": {
      "value": "30 September",
      "quote": "year ended 30 September 2025",
      "page": 3,
      "note": null,
      "source": {
        "label": "NAB 2025 Annual Report p3",
        "url": "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2025-annual-report.pdf#page=3",
        "date": "2025-09-30"
      }
    },
    "revenue": {
      "measure": "operating income",
      "value": "A$20,872m",
      "quote": "Net operating income 20,872 20,632",
      "page": 93,
      "note": "Net operating income (banks report operating income, not revenue).",
      "source": {
        "label": "NAB 2025 Annual Report p93",
        "url": "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2025-annual-report.pdf#page=93",
        "date": "2025-09-30"
      }
    },
    "profit": {
      "value": "A$6,759m",
      "quote": "Net profit attributable to owners of the Company 6,759 6,960",
      "page": 92,
      "note": "Attributable to owners of the Company.",
      "source": {
        "label": "NAB 2025 Annual Report p92",
        "url": "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2025-annual-report.pdf#page=92",
        "date": "2025-09-30"
      }
    },
    "employees": {
      "value": "41,880",
      "quote": "FTE (spot) 41,880",
      "page": 92,
      "note": "Full-time equivalent employees, spot.",
      "source": {
        "label": "NAB 2025 Annual Report p92",
        "url": "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2025-annual-report.pdf#page=92",
        "date": "2025-09-30"
      }
    },
    "auditor": {
      "value": "Ernst & Young",
      "quote": "Ernst & Young",
      "page": 244,
      "note": "Signed the independent auditor’s report (ey.com/au letterhead).",
      "source": {
        "label": "NAB 2025 Annual Report p244",
        "url": "https://www.nab.com.au/content/dam/nab/documents/reports/corporate/2025-annual-report.pdf#page=244",
        "date": "2025-09-30"
      }
    }
  },
  "WBC": {
    "fye": {
      "value": "30 September",
      "quote": "year ended 30 September 2025",
      "page": 17,
      "note": null,
      "source": {
        "label": "Westpac 2025 Annual Report p17",
        "url": "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-annual-report-2025.pdf#page=17",
        "date": "2025-09-30"
      }
    },
    "revenue": {
      "measure": "operating income",
      "value": "A$22,384m",
      "quote": "Net operating income 22,384 21,588",
      "page": 104,
      "note": "Net operating income, five-year summary (banks report operating income, not revenue).",
      "source": {
        "label": "Westpac 2025 Annual Report p104",
        "url": "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-annual-report-2025.pdf#page=104",
        "date": "2025-09-30"
      }
    },
    "profit": {
      "value": "A$6,916m",
      "quote": "Net profit after tax attributable to owners of WBC ($m) 6,916",
      "page": 75,
      "note": "Attributable to owners of WBC.",
      "source": {
        "label": "Westpac 2025 Annual Report p75",
        "url": "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-annual-report-2025.pdf#page=75",
        "date": "2025-09-30"
      }
    },
    "employees": {
      "value": "35,000",
      "quote": "For our 35,000 employees",
      "page": 4,
      "note": "As stated; rounded.",
      "source": {
        "label": "Westpac 2025 Annual Report p4",
        "url": "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-annual-report-2025.pdf#page=4",
        "date": "2025-09-30"
      }
    },
    "auditor": {
      "value": "KPMG",
      "quote": "This year, we transitioned to a new external auditor KPMG",
      "page": 7,
      "note": "New auditor for FY2025, after 55 years with PwC.",
      "source": {
        "label": "Westpac 2025 Annual Report p7",
        "url": "https://www.westpac.com.au/content/dam/public/wbc/documents/pdf/aw/ic/wbc-annual-report-2025.pdf#page=7",
        "date": "2025-09-30"
      }
    }
  },
  "ANZ": {
    "fye": {
      "value": "30 September",
      "quote": "year ended 30 September 2025",
      "page": 53,
      "note": null,
      "source": {
        "label": "ANZ Group 2025 Annual Report p53",
        "url": "https://www.anz.com/content/dam/anzcom/shareholder/2025-annual-report/anz-2025-annual-report.pdf#page=53",
        "date": "2025-09-30"
      }
    },
    "revenue": {
      "measure": "operating income",
      "value": "A$22,186m",
      "quote": "Operating income 22,186 21,899 20,547 20,809",
      "page": 40,
      "note": "Statutory operating income, 2025 (columns: 2025 statutory, 2025 cash, 2024 statutory, 2024 cash).",
      "source": {
        "label": "ANZ Group 2025 Annual Report p40",
        "url": "https://www.anz.com/content/dam/anzcom/shareholder/2025-annual-report/anz-2025-annual-report.pdf#page=40",
        "date": "2025-09-30"
      }
    },
    "profit": {
      "value": "A$5,891m",
      "quote": "Profit attributable to shareholders of the Company 5,891 6,535",
      "page": 98,
      "note": "Statutory, attributable to shareholders.",
      "source": {
        "label": "ANZ Group 2025 Annual Report p98",
        "url": "https://www.anz.com/content/dam/anzcom/shareholder/2025-annual-report/anz-2025-annual-report.pdf#page=98",
        "date": "2025-09-30"
      }
    },
    "employees": {
      "value": "42,698",
      "quote": "No. of employees (full time equivalents) 42,698",
      "page": 38,
      "note": "Full-time equivalents.",
      "source": {
        "label": "ANZ Group 2025 Annual Report p38",
        "url": "https://www.anz.com/content/dam/anzcom/shareholder/2025-annual-report/anz-2025-annual-report.pdf#page=38",
        "date": "2025-09-30"
      }
    },
    "auditor": {
      "value": "KPMG",
      "quote": "The Group’s external auditor is KPMG",
      "page": 95,
      "note": null,
      "source": {
        "label": "ANZ Group 2025 Annual Report p95",
        "url": "https://www.anz.com/content/dam/anzcom/shareholder/2025-annual-report/anz-2025-annual-report.pdf#page=95",
        "date": "2025-09-30"
      }
    }
  },
  "MQG": {
    "fye": {
      "value": "31 March",
      "quote": "year ended 31 March 2026",
      "page": 1,
      "note": null,
      "source": {
        "label": "Macquarie Group 2026 Annual Report p1",
        "url": "https://announcements.asx.com.au/asxpdf/20260508/pdf/06zcwby8r05n9g.pdf#page=1",
        "date": "2026-03-31"
      }
    },
    "revenue": {
      "measure": "operating income",
      "value": "A$19,477m",
      "quote": "Net operating income of $A19,477 million for the year ended 31 March 2026",
      "page": 32,
      "note": "Net operating income.",
      "source": {
        "label": "Macquarie Group 2026 Annual Report p32",
        "url": "https://announcements.asx.com.au/asxpdf/20260508/pdf/06zcwby8r05n9g.pdf#page=32",
        "date": "2026-03-31"
      }
    },
    "profit": {
      "value": "A$4,847m",
      "quote": "Profit attributable to ordinary equity holders of $A4,847 million for the year ended 31 March 2026",
      "page": 30,
      "note": "Attributable to ordinary equity holders.",
      "source": {
        "label": "Macquarie Group 2026 Annual Report p30",
        "url": "https://announcements.asx.com.au/asxpdf/20260508/pdf/06zcwby8r05n9g.pdf#page=30",
        "date": "2026-03-31"
      }
    },
    "employees": {
      "value": "19,124",
      "quote": "Macquarie now employs 19,124 people globally",
      "page": 9,
      "note": null,
      "source": {
        "label": "Macquarie Group 2026 Annual Report p9",
        "url": "https://announcements.asx.com.au/asxpdf/20260508/pdf/06zcwby8r05n9g.pdf#page=9",
        "date": "2026-03-31"
      }
    },
    "auditor": {
      "value": "PricewaterhouseCoopers",
      "quote": "the external auditor, PricewaterhouseCoopers (PwC)",
      "page": 52,
      "note": "KPMG recommended from the financial year commencing 1 April 2027, subject to regulatory consents and shareholder approval (same page).",
      "source": {
        "label": "Macquarie Group 2026 Annual Report p52",
        "url": "https://announcements.asx.com.au/asxpdf/20260508/pdf/06zcwby8r05n9g.pdf#page=52",
        "date": "2026-03-31"
      }
    }
  },
  "CSL": {
    "fye": {
      "value": "30 June",
      "quote": "year ended 30 June 2026",
      "page": 1,
      "note": null,
      "source": {
        "label": "CSL Statutory Accounts FY2026 (Appendix 4E and Annual Report) p1",
        "url": "https://investors.csl.com/pdf/be88bd1b-9d53-409a-9d6e-43da41dae1d5/Platform/ListPage/CSL-Statutory-Accounts-for-FY2026.pdf#page=1",
        "date": "2026-06-30"
      }
    },
    "revenue": {
      "value": "US$15,797m",
      "quote": "Revenue from ordinary activities 15,797 15,558",
      "page": 2,
      "note": null,
      "source": {
        "label": "CSL Statutory Accounts FY2026 (Appendix 4E and Annual Report) p2",
        "url": "https://investors.csl.com/pdf/be88bd1b-9d53-409a-9d6e-43da41dae1d5/Platform/ListPage/CSL-Statutory-Accounts-for-FY2026.pdf#page=2",
        "date": "2026-06-30"
      }
    },
    "profit": {
      "value": "Net loss US$2,579m",
      "quote": "attributable to members of the parent entity1 (2,579) 3,002",
      "page": 2,
      "note": "Reported NPAT attributable to members; underlying NPATA was US$3,098m.",
      "source": {
        "label": "CSL Statutory Accounts FY2026 (Appendix 4E and Annual Report) p2",
        "url": "https://investors.csl.com/pdf/be88bd1b-9d53-409a-9d6e-43da41dae1d5/Platform/ListPage/CSL-Statutory-Accounts-for-FY2026.pdf#page=2",
        "date": "2026-06-30"
      }
    },
    "employees": {
      "value": "almost 29,000",
      "quote": "employs almost 29,000 people globally",
      "page": 5,
      "note": "As stated; rounded.",
      "source": {
        "label": "CSL Statutory Accounts FY2026 (Appendix 4E and Annual Report) p5",
        "url": "https://investors.csl.com/pdf/be88bd1b-9d53-409a-9d6e-43da41dae1d5/Platform/ListPage/CSL-Statutory-Accounts-for-FY2026.pdf#page=5",
        "date": "2026-06-30"
      }
    },
    "auditor": {
      "value": "Deloitte Touche Tohmatsu",
      "quote": "Member of Deloitte Asia Pacific Limited and the Deloitte organisation. Deloitte Touche Tohmatsu",
      "page": 142,
      "note": null,
      "source": {
        "label": "CSL Statutory Accounts FY2026 (Appendix 4E and Annual Report) p142",
        "url": "https://investors.csl.com/pdf/be88bd1b-9d53-409a-9d6e-43da41dae1d5/Platform/ListPage/CSL-Statutory-Accounts-for-FY2026.pdf#page=142",
        "date": "2026-06-30"
      }
    }
  },
  "WES": {
    "fye": {
      "value": "30 June",
      "quote": "year ended 30 June 2026",
      "page": 3,
      "note": null,
      "source": {
        "label": "Wesfarmers 2026 Annual Report p3",
        "url": "https://announcements.asx.com.au/asxpdf/20260827/pdf/0738z357pt1vhl.pdf#page=3",
        "date": "2026-06-30"
      }
    },
    "revenue": {
      "value": "A$47,274m",
      "quote": "Revenue from ordinary activities Up 3.4% to $47,274 million",
      "page": 3,
      "note": null,
      "source": {
        "label": "Wesfarmers 2026 Annual Report p3",
        "url": "https://announcements.asx.com.au/asxpdf/20260827/pdf/0738z357pt1vhl.pdf#page=3",
        "date": "2026-06-30"
      }
    },
    "profit": {
      "value": "A$2,874m",
      "quote": "Net profit after tax $m 2,874 2,926",
      "page": 12,
      "note": null,
      "source": {
        "label": "Wesfarmers 2026 Annual Report p12",
        "url": "https://announcements.asx.com.au/asxpdf/20260827/pdf/0738z357pt1vhl.pdf#page=12",
        "date": "2026-06-30"
      }
    },
    "employees": {
      "value": "more than 100,000",
      "quote": "more than 100,000 team members",
      "page": 4,
      "note": "As stated; rounded.",
      "source": {
        "label": "Wesfarmers 2026 Annual Report p4",
        "url": "https://announcements.asx.com.au/asxpdf/20260827/pdf/0738z357pt1vhl.pdf#page=4",
        "date": "2026-06-30"
      }
    },
    "auditor": {
      "value": "Ernst & Young",
      "quote": "The company’s external auditor is Ernst & Young",
      "page": 110,
      "note": null,
      "source": {
        "label": "Wesfarmers 2026 Annual Report p110",
        "url": "https://announcements.asx.com.au/asxpdf/20260827/pdf/0738z357pt1vhl.pdf#page=110",
        "date": "2026-06-30"
      }
    }
  },
  "WDS": {
    "fye": {
      "value": "31 December",
      "quote": "year ended 31 December 2025",
      "page": 85,
      "note": null,
      "source": {
        "label": "Woodside 2025 Annual Report p85",
        "url": "https://announcements.asx.com.au/asxpdf/20260224/pdf/06wnjpjvgshc5z.pdf#page=85",
        "date": "2025-12-31"
      }
    },
    "revenue": {
      "value": "US$12,984m",
      "quote": "Revenue from ordinary activities decreased 1% to US$12,984 million",
      "page": 4,
      "note": null,
      "source": {
        "label": "Woodside 2025 Annual Report p4",
        "url": "https://announcements.asx.com.au/asxpdf/20260224/pdf/06wnjpjvgshc5z.pdf#page=4",
        "date": "2025-12-31"
      }
    },
    "profit": {
      "value": "US$2,718m",
      "quote": "Equity holders of the parent 2,718 3,573 1,660",
      "page": 179,
      "note": "Profit attributable to equity holders of the parent.",
      "source": {
        "label": "Woodside 2025 Annual Report p179",
        "url": "https://announcements.asx.com.au/asxpdf/20260224/pdf/06wnjpjvgshc5z.pdf#page=179",
        "date": "2025-12-31"
      }
    },
    "employees": {
      "value": "approximately 4,693",
      "quote": "Woodside had approximately 4,693 employees",
      "page": 262,
      "note": "At 31 December 2025.",
      "source": {
        "label": "Woodside 2025 Annual Report p262",
        "url": "https://announcements.asx.com.au/asxpdf/20260224/pdf/06wnjpjvgshc5z.pdf#page=262",
        "date": "2025-12-31"
      }
    },
    "auditor": {
      "value": "PricewaterhouseCoopers",
      "quote": "The auditor of Woodside Energy Group Ltd is PricewaterhouseCoopers Australia (PwC)",
      "page": 231,
      "note": null,
      "source": {
        "label": "Woodside 2025 Annual Report p231",
        "url": "https://announcements.asx.com.au/asxpdf/20260224/pdf/06wnjpjvgshc5z.pdf#page=231",
        "date": "2025-12-31"
      }
    }
  },
  "GMG": {
    "fye": {
      "value": "30 June",
      "quote": "year ended 30 June 2026",
      "page": 8,
      "note": null,
      "source": {
        "label": "Goodman Group Annual Report 2026 p8",
        "url": "https://www.goodman.com/-/media/project/goodman/global/files/investor-centre/gmg-goodman-group/announcements/asx-announcements/2026/2-goodman-2026-annual-report-1.pdf#page=8",
        "date": "2026-06-30"
      }
    },
    "revenue": {
      "value": "A$2,562.7m",
      "quote": "Distributions from investments 1.0 0.6 20.0 0.6 2,562.7 2,311.0",
      "page": 131,
      "note": "Total of the income statement’s Revenue lines (gross property, management and development income, distributions), Goodman column.",
      "source": {
        "label": "Goodman Group Annual Report 2026 p131",
        "url": "https://www.goodman.com/-/media/project/goodman/global/files/investor-centre/gmg-goodman-group/announcements/asx-announcements/2026/2-goodman-2026-annual-report-1.pdf#page=131",
        "date": "2026-06-30"
      }
    },
    "profit": {
      "value": "A$2,778.7m",
      "quote": "Profit for the year attributable to Securityholders 2,778.7 1,666.4",
      "page": 17,
      "note": null,
      "source": {
        "label": "Goodman Group Annual Report 2026 p17",
        "url": "https://www.goodman.com/-/media/project/goodman/global/files/investor-centre/gmg-goodman-group/announcements/asx-announcements/2026/2-goodman-2026-annual-report-1.pdf#page=17",
        "date": "2026-06-30"
      }
    },
    "employees": {
      "value": "1,061",
      "quote": "the Group employed 1,061 people globally",
      "page": 20,
      "note": "At 30 June 2026.",
      "source": {
        "label": "Goodman Group Annual Report 2026 p20",
        "url": "https://www.goodman.com/-/media/project/goodman/global/files/investor-centre/gmg-goodman-group/announcements/asx-announcements/2026/2-goodman-2026-annual-report-1.pdf#page=20",
        "date": "2026-06-30"
      }
    },
    "auditor": {
      "value": "KPMG",
      "quote": "KPMG, Goodman and GIT’s auditor",
      "page": 78,
      "note": null,
      "source": {
        "label": "Goodman Group Annual Report 2026 p78",
        "url": "https://www.goodman.com/-/media/project/goodman/global/files/investor-centre/gmg-goodman-group/announcements/asx-announcements/2026/2-goodman-2026-annual-report-1.pdf#page=78",
        "date": "2026-06-30"
      }
    }
  }
}
