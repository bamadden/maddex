// Sector taxonomy and index metadata.
//
// These six tables lived in SectorHeatmap.jsx, which four other modules then
// imported them from — so every one of those imports pulled a 1,900-line chart
// component into its graph, and eslint flagged the file six times for breaking
// fast refresh (a module exporting both components and constants cannot be
// hot-swapped cleanly).
//
// They are data, not UI. They belong here.

export const GICS_SECTORS = [
  'Information Technology',
  'Financials',
  'Health Care',
  'Consumer Discretionary',
  'Communication Services',
  'Industrials',
  'Consumer Staples',
  'Energy',
  'Materials',
  'Real Estate',
  'Utilities',
]

export const SECTOR_ABBR = {
  'Information Technology': 'IT',
  'Financials':             'FINANCIALS',
  'Health Care':            'HEALTH',
  'Consumer Discretionary': 'CONS DISC',
  'Communication Services': 'COMMS',
  'Industrials':            'INDUSTRIALS',
  'Consumer Staples':       'STAPLES',
  'Energy':                 'ENERGY',
  'Materials':              'MATERIALS',
  'Real Estate':            'REAL EST',
  'Utilities':              'UTILITIES',
}

// null = sector not applicable to this index (renders as greyed N/A tile)
export const INDEX_SECTORS = {
  '^AXJO': {
    'Information Technology': { sym: 'XRO.AX' },
    'Financials':             { sym: 'CBA.AX' },
    'Health Care':            { sym: 'CSL.AX' },
    'Consumer Discretionary': { sym: 'ALL.AX' },
    'Communication Services': { sym: 'TLS.AX' },
    'Industrials':            { sym: 'WES.AX' },
    'Consumer Staples':       { sym: 'WOW.AX' },
    'Energy':                 { sym: 'WDS.AX' },
    'Materials':              { sym: 'BHP.AX' },
    'Real Estate':            { sym: 'GMG.AX' },
    'Utilities':              { sym: 'AGL.AX' },
  },
  '^GSPC': {
    'Information Technology': { sym: 'AAPL' },
    'Financials':             { sym: 'JPM' },
    'Health Care':            { sym: 'JNJ' },
    'Consumer Discretionary': { sym: 'AMZN' },
    'Communication Services': { sym: 'GOOG' },
    'Industrials':            { sym: 'CAT' },
    'Consumer Staples':       { sym: 'PG' },
    'Energy':                 { sym: 'XOM' },
    'Materials':              { sym: 'LIN' },
    'Real Estate':            { sym: 'PLD' },
    'Utilities':              { sym: 'NEE' },
  },
  '^IXIC': {
    'Information Technology': { sym: 'NVDA' },
    'Financials':             { sym: 'PYPL' },
    'Health Care':            { sym: 'AMGN' },
    'Consumer Discretionary': { sym: 'TSLA' },
    'Communication Services': { sym: 'META' },
    'Industrials':            { sym: 'HON' },
    'Consumer Staples':       { sym: 'COST' },
    'Energy':                 null,
    'Materials':              null,
    'Real Estate':            null,
    'Utilities':              null,
  },
  '^DJI': {
    'Information Technology': { sym: 'MSFT' },
    'Financials':             { sym: 'GS' },
    'Health Care':            { sym: 'UNH' },
    'Consumer Discretionary': { sym: 'MCD' },
    'Communication Services': { sym: 'VZ' },
    'Industrials':            { sym: 'BA' },
    'Consumer Staples':       { sym: 'WMT' },
    'Energy':                 { sym: 'CVX' },
    'Materials':              { sym: 'DOW' },
    'Real Estate':            null,
    'Utilities':              null,
  },
  '^FTSE': {
    'Information Technology': { sym: 'SAGE.L' },
    'Financials':             { sym: 'HSBA.L' },
    'Health Care':            { sym: 'AZN.L' },
    'Consumer Discretionary': { sym: 'BRBY.L' },
    'Communication Services': { sym: 'VOD.L' },
    'Industrials':            { sym: 'BA.L' },
    'Consumer Staples':       { sym: 'ULVR.L' },
    'Energy':                 { sym: 'SHEL.L' },
    'Materials':              { sym: 'RIO.L' },
    'Real Estate':            { sym: 'LAND.L' },
    'Utilities':              { sym: 'NG.L' },
  },
  '^GDAXI': {
    'Information Technology': { sym: 'SAP.DE' },
    'Financials':             { sym: 'DBK.DE' },
    'Health Care':            { sym: 'BAYN.DE' },
    'Consumer Discretionary': { sym: 'BMW.DE' },
    'Communication Services': { sym: 'DTE.DE' },
    'Industrials':            { sym: 'SIE.DE' },
    'Consumer Staples':       { sym: 'HEN3.DE' },
    'Energy':                 { sym: 'RWE.DE' },
    'Materials':              { sym: 'BAS.DE' },
    'Real Estate':            { sym: 'VNA.DE' },
    'Utilities':              { sym: 'EOAN.DE' },
  },
  '^N225': {
    'Information Technology': { sym: '9984.T' },
    'Financials':             { sym: '8306.T' },
    'Health Care':            { sym: '4519.T' },
    'Consumer Discretionary': { sym: '7203.T' },
    'Communication Services': { sym: '9432.T' },
    'Industrials':            { sym: '6501.T' },
    'Consumer Staples':       { sym: '2502.T' },
    'Energy':                 { sym: '5020.T' },
    'Materials':              { sym: '4063.T' },
    'Real Estate':            { sym: '8801.T' },
    'Utilities':              { sym: '9020.T' },
  },
  '^HSI': {
    'Information Technology': { sym: '0700.HK' },
    'Financials':             { sym: '0005.HK' },
    'Health Care':            { sym: '1299.HK' },
    'Consumer Discretionary': { sym: '9988.HK' },
    'Communication Services': { sym: '0941.HK' },
    'Industrials':            { sym: '0066.HK' },
    'Consumer Staples':       { sym: '0291.HK' },
    'Energy':                 { sym: '0883.HK' },
    'Materials':              { sym: '1088.HK' },
    'Real Estate':            { sym: '0016.HK' },
    'Utilities':              { sym: '0002.HK' },
  },
  '^NZ50': {
    'Information Technology': { sym: 'IFT.NZ' },
    'Financials':             { sym: 'SKC.NZ' },
    'Health Care':            { sym: 'FPH.NZ' },
    'Consumer Discretionary': { sym: 'KMD.NZ' },
    'Communication Services': { sym: 'SPK.NZ' },
    'Industrials':            { sym: 'AIR.NZ' },
    'Consumer Staples':       { sym: 'ATM.NZ' },
    'Energy':                 { sym: 'CEN.NZ' },
    'Materials':              null,
    'Real Estate':            { sym: 'PCT.NZ' },
    'Utilities':              { sym: 'MEL.NZ' },
  },
  '000001.SS': {
    'Information Technology': { sym: '688981.SS' },
    'Financials':             { sym: '601398.SS' },
    'Health Care':            { sym: '600276.SS' },
    'Consumer Discretionary': { sym: '600104.SS' },
    'Communication Services': { sym: '601728.SS' },
    'Industrials':            { sym: '601669.SS' },
    'Consumer Staples':       { sym: '600519.SS' },
    'Energy':                 { sym: '600028.SS' },
    'Materials':              { sym: '600900.SS' },
    'Real Estate':            { sym: '600048.SS' },
    'Utilities':              { sym: '600900.SS' },
  },
}

export const ASX_SECTOR_STOCKS = {
  'Information Technology': [
    ['WTC.AX','WiseTech Global'],['XRO.AX','Xero'],['CPU.AX','Computershare'],
    ['NXT.AX','NextDC'],['ALU.AX','Altium'],['SEK.AX','Seek'],['CAR.AX','CAR Group'],
  ],
  'Financials': [
    ['CBA.AX','Commonwealth Bank'],['ANZ.AX','ANZ'],['WBC.AX','Westpac'],['NAB.AX','NAB'],
    ['MQG.AX','Macquarie'],['QBE.AX','QBE Insurance'],['IAG.AX','IAG'],['AMP.AX','AMP'],
  ],
  'Health Care': [
    ['CSL.AX','CSL'],['RHC.AX','Ramsay Health'],['SHL.AX','Sonic Healthcare'],
    ['COH.AX','Cochlear'],['PME.AX','Pro Medicus'],['RMD.AX','ResMed'],['NHF.AX','nib Holdings'],
  ],
  'Consumer Discretionary': [
    ['ALL.AX','Aristocrat'],['WEB.AX','Webjet'],['ARB.AX','ARB Corp'],
    ['PMV.AX','Premier Investments'],['LOV.AX','Lovisa'],['SUL.AX','Super Retail'],
    ['GUD.AX','GUD Holdings'],
  ],
  'Communication Services': [
    ['TLS.AX','Telstra'],['REA.AX','REA Group'],['CAR.AX','CAR Group'],
    ['SEK.AX','Seek'],['NXT.AX','NextDC'],['SXL.AX','Southern Cross Media'],
  ],
  'Industrials': [
    ['BXB.AX','Brambles'],['WOR.AX','Worley'],['TCL.AX','Transurban'],
    ['ALQ.AX','ALS'],['DOW.AX','Downer EDI'],['QAN.AX','Qantas'],
  ],
  'Consumer Staples': [
    ['WOW.AX','Woolworths'],['COL.AX','Coles'],['MTS.AX','Metcash'],
    ['TWE.AX','Treasury Wine'],['GNC.AX','GrainCorp'],['ING.AX','Inghams'],
  ],
  'Energy': [
    ['WDS.AX','Woodside Energy'],['STO.AX','Santos'],['BPT.AX','Beach Energy'],
    ['KAR.AX','Karoon Energy'],['VEA.AX','Viva Energy'],['NHC.AX','New Hope Coal'],
  ],
  'Materials': [
    ['BHP.AX','BHP'],['RIO.AX','Rio Tinto'],['FMG.AX','Fortescue'],['S32.AX','South32'],
    ['MIN.AX','Mineral Resources'],['ILU.AX','Iluka'],['SFR.AX','Sandfire'],
  ],
  'Real Estate': [
    ['GMG.AX','Goodman Group'],['SCG.AX','Scentre Group'],['VCX.AX','Vicinity Centres'],
    ['DXS.AX','Dexus'],['MGR.AX','Mirvac'],['BWP.AX','BWP Trust'],['CLW.AX','Charter Hall'],
  ],
  'Utilities': [
    ['AGL.AX','AGL Energy'],['ORG.AX','Origin Energy'],['APA.AX','APA Group'],
    ['AST.AX','AusNet Services'],['MEZ.AX','Meridian Energy'],
  ],
}

export const INDEX_LABELS = {
  '^AXJO':'ASX 200','^AORD':'All Ords','^GSPC':'S&P 500','^IXIC':'NASDAQ 100',
  '^DJI':'Dow Jones 30','^FTSE':'FTSE 100','^N225':'Nikkei 225',
  '^GDAXI':'DAX 40','^HSI':'Hang Seng','^NZ50':'NZX 50','000001.SS':'Shanghai',
}

export const INDEX_METADATA = {
  '^AXJO': { lastUpdated:'2026-07-01', nextRebalance:'2026-09-01', source:'ASX',             sourceUrl:'https://www.asx.com.au' },
  '^AORD': { lastUpdated:'2026-07-01', nextRebalance:'2026-09-01', source:'ASX',             sourceUrl:'https://www.asx.com.au' },
  '^GSPC': { lastUpdated:'2026-07-01', nextRebalance:'2026-09-01', source:'S&P Dow Jones',   sourceUrl:'https://www.spglobal.com' },
  '^IXIC': { lastUpdated:'2026-07-01', nextRebalance:'2026-09-01', source:'Nasdaq',          sourceUrl:'https://www.nasdaq.com' },
  '^DJI':  { lastUpdated:'2026-07-01', nextRebalance:'2026-09-01', source:'S&P Dow Jones',   sourceUrl:'https://www.spglobal.com' },
  '^FTSE': { lastUpdated:'2026-07-01', nextRebalance:'2026-09-01', source:'FTSE Russell',    sourceUrl:'https://www.ftserussell.com' },
  '^GDAXI':{ lastUpdated:'2026-07-01', nextRebalance:'2026-09-01', source:'Deutsche Börse',  sourceUrl:'https://www.deutsche-boerse.com' },
  '^N225': { lastUpdated:'2026-07-01', nextRebalance:'2027-01-01', source:'Nikkei',          sourceUrl:'https://indexes.nikkei.co.jp' },
  '^HSI':  { lastUpdated:'2026-07-01', nextRebalance:'2026-09-01', source:'Hang Seng Indexes',sourceUrl:'https://www.hsi.com.hk' },
  '^NZ50': { lastUpdated:'2026-07-01', nextRebalance:'2026-09-01', source:'NZX',             sourceUrl:'https://www.nzx.com' },
  '000001.SS': { lastUpdated:'2026-07-01', nextRebalance:'2026-09-01', source:'SSE',         sourceUrl:'https://www.sse.com.cn' },
}
