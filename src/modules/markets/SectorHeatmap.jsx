import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { fetchYahooBatch, fetchYFHistory, transformYFHistory, USING_MOCK_DATA } from '../../services/api'
import { fmt } from '../../utils/format'
import { dispatchAskAI, todayAEST } from '../../utils/askAI'
import { useAudRates } from '../../hooks/useAudRates'
import { useStore } from '../../store/useStore'
import { useSubscription } from '../../hooks/useSubscription'
import UpgradePrompt from '../../components/ui/UpgradePrompt'
import { DemoBadge } from '../../components/ui/ModuleStates'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush,
} from 'recharts'
import SectorLandscape3D from '../../components/visualisations/SectorLandscape3D'
import CorrelationMatrix from '../../components/charts/CorrelationMatrix'

// ─── GICS Sector Configuration ───────────────────────────────────────────────
// Official 11 GICS sectors used by ASX, S&P, NASDAQ, and all major indices

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
// All Ords has no separately curated sector-proxy list — it tracks the ASX
// 200 closely enough (same market, much larger constituent set) to reuse it.
INDEX_SECTORS['^AORD'] = INDEX_SECTORS['^AXJO']

// ─── ASX Constituent Stocks (by GICS sector name) ────────────────────────────

const ASX_SECTOR_STOCKS = {
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

// TODO: When Twelve Data paid tier is enabled, replace hardcoded lists with:
// GET https://api.twelvedata.com/indices/constituents?symbol=SPX&apikey=KEY
// This returns live, always-current index compositions updated automatically
// ─── Index constituents (Yahoo Finance symbols) ───────────────────────────────

const INDEX_CONSTITUENTS = {
  '^AXJO': [
    'BHP.AX','CBA.AX','CSL.AX','ANZ.AX','NAB.AX','WBC.AX','WES.AX','MQG.AX','WOW.AX','RIO.AX',
    'GMG.AX','FMG.AX','TLS.AX','REA.AX','ALL.AX','MIN.AX','STO.AX','WDS.AX','AGL.AX','NEM.AX',
    'XRO.AX','COL.AX','TCL.AX','QBE.AX','SHL.AX','IAG.AX','MPL.AX','ORG.AX','APA.AX','ASX.AX',
    'BXB.AX','CPU.AX','DXS.AX','EVN.AX','GPT.AX','IEL.AX','JHX.AX','LLC.AX','MGR.AX','NCM.AX',
    'NST.AX','ORI.AX','PLS.AX','RMD.AX','SGP.AX','SKI.AX','SUN.AX','TAH.AX','TWE.AX','VCX.AX',
    'VNT.AX','WHC.AX','WPR.AX','WSP.AX','Z1P.AX','360.AX','ABB.AX','ABC.AX','ACL.AX','ACQ.AX',
    'ADA.AX','ADH.AX','ADI.AX','AEF.AX','AGY.AX','AHY.AX','AIA.AX','AIS.AX','AKE.AX','ALD.AX',
    'ALQ.AX','ALU.AX','AMC.AX','AMP.AX','AMS.AX','ANN.AX','AOF.AX','APE.AX','APM.AX','APX.AX',
    'ARB.AX','ARF.AX','ARG.AX','ASB.AX','ASG.AX','AST.AX','ATL.AX','AUB.AX','AVN.AX','AWC.AX',
    'AWF.AX','AX1.AX','AZJ.AX','BAP.AX','BEN.AX','BGP.AX','BKW.AX','BLD.AX','BOE.AX','BOQ.AX',
    'BPT.AX','BSL.AX','BWP.AX','CAR.AX','CGF.AX','CHC.AX','CIA.AX','CIP.AX','CLW.AX','CMW.AX',
    'CNI.AX','COH.AX','CQE.AX','CQR.AX','CRN.AX','CTD.AX','CUV.AX','CWY.AX','DEG.AX','DHG.AX',
    'DMP.AX','DOW.AX','DRR.AX','EBO.AX','ELD.AX','ELO.AX','EMR.AX','EQR.AX','EXP.AX','FCL.AX',
    'FLT.AX','FPH.AX','GDF.AX','GEM.AX','GNE.AX','GOZ.AX','GQG.AX','GUD.AX','GWA.AX','HLI.AX',
    'HLS.AX','HMC.AX','HSN.AX','HUB.AX','HVN.AX','IFL.AX','IGO.AX','ILU.AX','IMD.AX','INA.AX',
    'INR.AX','IOO.AX','IPH.AX','IVC.AX','JBH.AX','JDO.AX','JHG.AX','KAR.AX','KGN.AX','KLS.AX',
    'LFG.AX','LGI.AX','LNK.AX','LOV.AX','LYC.AX','MAF.AX','MCR.AX','MEZ.AX','MFG.AX','MGH.AX',
    'MHJ.AX','MMA.AX','MND.AX','MNF.AX','MPB.AX','MSB.AX','MTS.AX','MVF.AX','MYX.AX','NAM.AX',
    'ACF.AX','ADD.AX','ALK.AX','DUG.AX','GNG.AX','MRM.AX','MTO.AX','NCK.AX','NHF.AX','NUF.AX',
    'NWH.AX','OFX.AX','ORA.AX','PAC.AX','PDL.AX','PGH.AX','PME.AX','PNI.AX','PPT.AX','PTM.AX',
    'QAN.AX','RHC.AX','RWC.AX','S32.AX','SAR.AX','SDR.AX','SEK.AX','SGM.AX','SIG.AX','SOL.AX',
    'SPK.AX','SSM.AX','SVW.AX','SWM.AX','TIE.AX','TNE.AX','TPG.AX','TYR.AX','WAF.AX','WAM.AX',
    'WEB.AX','WOR.AX','YAL.AX',
  ],
  '^GSPC': [
    'AAPL','NVDA','MSFT','AMZN','META','GOOG','GOOGL','TSLA','BRK-B','JPM',
    'UNH','V','XOM','MA','JNJ','PG','HD','AVGO','MRK','ABBV',
    'BAC','COST','CVX','NFLX','CRM','AMD','ADBE','TMO','ACN','WFC',
    'LIN','DHR','TXN','QCOM','MCD','ABT','PM','INTU','CAT','GS',
    'MS','BLK','SPGI','ISRG','RTX','AXP','SYK','LOW','VRTX','NOW',
    'LLY','NVO','WMT','KO','PEP','GE','IBM','BKNG','PLD','TJX',
    'GILD','ELV','MDT','SCHW','UPS','DE','ADI','MU','LRCX','C',
    'ETN','ZTS','BSX','MMC','CB','SO','DUK','ITW','AON','SLB',
    'CME','KLAC','USB','CL','HCA','TGT','FI','MCO','AMT','CCI',
    'PSA','REGN','PANW','SNPS','CDNS','MRVL','CRWD','FTNT','DXCM','WDAY',
    'TEAM','ORLY','MNST','IDXX','PCAR','ODFL','FAST','VRSK','ANSS',
  ],
  '^IXIC': [
    'AAPL','NVDA','MSFT','AMZN','META','GOOG','TSLA','AVGO','COST','NFLX',
    'AMD','ADBE','QCOM','TXN','INTU','CSCO','AMGN','AMAT','MU','LRCX',
    'PANW','KLAC','SNPS','CDNS','MRVL','ABNB','CRWD','FTNT','DXCM','WDAY',
    'TEAM','ORLY','MNST','CSGP','CPRT','IDXX','BIIB','ILMN','PCAR','ODFL',
    'FAST','VRSK','ANSS','CTSH','DLTR','EA','EXC','FANG','GFS','HON',
  ],
  '^DJI': [
    'AAPL','MSFT','UNH','GS','HD','CAT','CRM','V','MCD','AMGN',
    'AXP','BA','HON','JPM','IBM','TRV','JNJ','WMT','PG','CVX',
    'MRK','MMM','DIS','KO','CSCO','VZ','NKE','DOW','WBA','INTC',
  ],
  '^FTSE': [
    'SHEL.L','AZN.L','HSBA.L','ULVR.L','BP.L','RIO.L','GSK.L','BHP.L','DGE.L','LLOY.L',
    'BARC.L','VOD.L','BATS.L','NG.L','PRU.L','ABF.L','ANTO.L','AUTO.L','AV.L','BA.L',
    'BKG.L','BNZL.L','BRBY.L','CCH.L','CNA.L','CPG.L','CRDA.L','EMG.L','EZJ.L','SAGE.L',
    'LAND.L','RR.L','IMB.L','III.L','HLMA.L','REL.L','WPP.L','EXPN.L','SKG.L','LSEG.L',
    'FERG.L','FLTR.L','GLEN.L','HIK.L','HL.L','IAG.L','IHG.L','ITV.L','JD.L','KGF.L',
    'LGEN.L','MKS.L','MNDI.L','MNG.L','MRO.L','MTO.L','NWG.L','NXT.L','OCDO.L','PFC.L',
    'PSON.L','PSN.L','PHNX.L','RKT.L','RMG.L','SBRY.L','SDR.L','SGE.L','SGRO.L','SMT.L',
    'SN.L','SSE.L','STAN.L','SVT.L','TSCO.L','UU.L','VTY.L','WEIR.L','AAF.L','AAL.L',
    'ADM.L','AGK.L','AHT.L','AIBG.L','AML.L','DCC.L','HMS.L','INF.L','MGG.L','PHX.L',
    'RSA.L','SPX.L','STJ.L','TUI.L','WG.L','WHP.L','WMH.L','WTB.L',
  ],
  '^N225': [
    '7203.T','9984.T','6861.T','8306.T','6758.T','9432.T','7974.T','4519.T','8316.T','6367.T',
    '9433.T','4523.T','6501.T','7267.T','8411.T','9020.T','4502.T','6902.T','7751.T','8035.T',
    '4063.T','6954.T','7832.T','8001.T','8031.T','9022.T','5108.T','6645.T','4568.T','6971.T',
    '1925.T','2503.T','3382.T','4543.T','5401.T','6098.T','6146.T','6273.T','6301.T','6326.T',
    '6471.T','6503.T','6702.T','6723.T','6752.T','6762.T','6857.T','6869.T','6920.T','7011.T',
    '7733.T','7741.T','7762.T',
  ],
  '^GDAXI': [
    'SAP.DE','SIE.DE','ALV.DE','MRK.DE','DTE.DE','BAYN.DE','BMW.DE','MUV2.DE','EOAN.DE','BAS.DE',
    'RWE.DE','HEN3.DE','VOW3.DE','DBK.DE','FRE.DE','MTX.DE','ADS.DE','BEI.DE','CON.DE','DHL.DE',
    'HEI.DE','IFX.DE','LIN.DE','MBG.DE','PUM.DE','QGEN.DE','SHL.DE','VNA.DE','ZAL.DE','DTG.DE',
    'ENR.DE','EVK.DE','FNTN.DE','HFG.DE','MAN.DE','PAH3.DE','RHM.DE','SRT3.DE','SY1.DE','TKA.DE',
  ],
  '^HSI': [
    '0700.HK','0941.HK','1299.HK','0005.HK','0939.HK','2318.HK','1398.HK','3988.HK','0388.HK','2628.HK',
    '0883.HK','1109.HK','0016.HK','0011.HK','0688.HK','1038.HK','0002.HK','0003.HK','0012.HK','0017.HK',
    '0066.HK','0101.HK','0151.HK','0175.HK','0267.HK','9988.HK','9618.HK','9999.HK','1088.HK','0291.HK',
    '0288.HK','0316.HK','0322.HK','0386.HK','0669.HK','0762.HK','0823.HK','0857.HK','0868.HK','0960.HK',
    '0981.HK','1044.HK','1093.HK','1177.HK','1211.HK','1928.HK','2007.HK','2020.HK','2269.HK','2313.HK',
    '2382.HK','2388.HK',
  ],
  '^NZ50': [
    'FPH.NZ','ATM.NZ','SKC.NZ','MEL.NZ','CEN.NZ','SPK.NZ','RYM.NZ','IFT.NZ','AIA.NZ','PCT.NZ',
    'PFI.NZ','GNE.NZ','VHP.NZ','ARG.NZ','EBO.NZ','KMD.NZ','MFT.NZ','OCA.NZ','SUM.NZ','WHS.NZ',
    'AIR.NZ','HGH.NZ','MHJ.NZ','NPX.NZ','NZR.NZ',
    'ANZ.NZ','BIT.NZ','CVT.NZ','DGL.NZ','ERD.NZ','FBU.NZ','FSF.NZ','GTK.NZ','IKE.NZ','IPL.NZ',
    'MCK.NZ','MWE.NZ','NZS.NZ','PEB.NZ','POT.NZ','RAK.NZ','SCL.NZ','SEK.NZ','SKL.NZ','STU.NZ',
    'TLT.NZ',
  ],
  '000001.SS': [
    '601398.SS','601288.SS','600519.SS','601628.SS','601318.SS','600036.SS','601166.SS',
    '600276.SS','601601.SS','600900.SS','601088.SS','600028.SS','601669.SS','601328.SS',
    '600104.SS','601186.SS','600048.SS','601211.SS','601390.SS','688981.SS',
    '600000.SS','600016.SS','600019.SS','600031.SS','600050.SS','600089.SS','600196.SS',
    '600309.SS','600340.SS','600406.SS','600436.SS','600438.SS','600547.SS','600570.SS',
    '600585.SS','600588.SS','600600.SS','600690.SS','600703.SS','600745.SS','600809.SS',
    '600837.SS','600887.SS','600999.SS','601006.SS','601012.SS','601066.SS','601155.SS',
    '601229.SS','601336.SS',
  ],
}
INDEX_CONSTITUENTS['^AORD'] = INDEX_CONSTITUENTS['^AXJO']

const STOCK_NAMES = {
  // ASX top 20
  'BHP.AX':'BHP Group','CBA.AX':'Commonwealth Bank','CSL.AX':'CSL','ANZ.AX':'ANZ Banking',
  'NAB.AX':'NAB','WBC.AX':'Westpac','WES.AX':'Wesfarmers','MQG.AX':'Macquarie Group',
  'WOW.AX':'Woolworths','RIO.AX':'Rio Tinto','GMG.AX':'Goodman Group','FMG.AX':'Fortescue',
  'TLS.AX':'Telstra','REA.AX':'REA Group','ALL.AX':'Aristocrat','MIN.AX':'Mineral Resources',
  'STO.AX':'Santos','WDS.AX':'Woodside Energy','AGL.AX':'AGL Energy','NEM.AX':'Newmont',
  // ASX 200 extended
  'XRO.AX':'Xero','COL.AX':'Coles Group','TCL.AX':'Transurban','QBE.AX':'QBE Insurance',
  'SHL.AX':'Sonic Healthcare','IAG.AX':'Insurance Australia','MPL.AX':'Medibank Private',
  'ORG.AX':'Origin Energy','APA.AX':'APA Group','ASX.AX':'ASX Limited','BXB.AX':'Brambles',
  'CPU.AX':'Computershare','DXS.AX':'Dexus','EVN.AX':'Evolution Mining','GPT.AX':'GPT Group',
  'IEL.AX':'IDP Education','JHX.AX':'James Hardie','LLC.AX':'Lendlease','MGR.AX':'Mirvac Group',
  'NCM.AX':'Newcrest Mining','NST.AX':'Northern Star','ORI.AX':'Orica','PLS.AX':'Pilbara Minerals',
  'RMD.AX':'ResMed','SGP.AX':'Stockland','SKI.AX':'Spark Infrastructure','SUN.AX':'Suncorp Group',
  'TAH.AX':'Tabcorp','TWE.AX':'Treasury Wine','VCX.AX':'Vicinity Centres','VNT.AX':'Ventia',
  'WHC.AX':'Whitehaven Coal','WPR.AX':'Waypoint REIT','WSP.AX':'Whispir','Z1P.AX':'Zip Co',
  '360.AX':'Life360','ABB.AX':'Abbvie AU','ABC.AX':'AdBri','ACL.AX':'Acusensus',
  'ACQ.AX':'Acorn Capital','ADA.AX':'Adacel Technologies','ADH.AX':'Adairs',
  'ADI.AX':'APN Industria REIT','AEF.AX':'Australian Ethical','AGY.AX':'Argosy Minerals',
  'AHY.AX':'Asahi Holdings','AIA.AX':'Auckland Airport','AIS.AX':'Aeris Resources',
  'AKE.AX':'Allkem','ALD.AX':'Ampol','ALQ.AX':'ALS Limited','ALU.AX':'Altium',
  'AMC.AX':'Amcor','AMP.AX':'AMP Limited','AMS.AX':'Atomos','ANN.AX':'Ansell',
  'AOF.AX':'Australian Unity Office','APE.AX':'Eagers Automotive','APM.AX':'APM Human Services',
  'APX.AX':'Appen','ARB.AX':'ARB Corporation','ARF.AX':'Arena REIT','ARG.AX':'Argo Investments',
  'ASB.AX':'Austal','ASG.AX':'Autosports Group','AST.AX':'AusNet Services',
  'ATL.AX':'Apollo Tourism','AUB.AX':'AUB Group','AVN.AX':'Aventus Group',
  'AWC.AX':'Alumina Limited','AWF.AX':'AWF Group','AX1.AX':'Accent Group',
  'AZJ.AX':'Aurizon Holdings','BAP.AX':'Bapcor','BEN.AX':'Bendigo & Adelaide Bank',
  'BGP.AX':'Baby Bunting','BKW.AX':'Brickworks','BLD.AX':'Boral Limited','BOE.AX':'Boss Energy',
  'BOQ.AX':'Bank of Queensland','BPT.AX':'Beach Energy','BSL.AX':'BlueScope Steel',
  'BWP.AX':'BWP Trust','CAR.AX':'CAR Group','CGF.AX':'Challenger','CHC.AX':'Charter Hall',
  'CIA.AX':'Champion Iron','CIP.AX':'Centuria Industrial REIT','CLW.AX':'Charter Hall Long WALE',
  'CMW.AX':'Cromwell Property','CNI.AX':'Centuria Capital','COH.AX':'Cochlear',
  'CQE.AX':'Charter Hall Education Trust','CQR.AX':'Charter Hall Retail',
  'CRN.AX':'Coronado Global Resources','CTD.AX':'Corporate Travel Mgmt',
  'CUV.AX':'Clinuvel Pharmaceuticals','CWY.AX':'Cleanaway Waste Mgmt',
  'DEG.AX':'De Grey Mining','DHG.AX':'Domain Holdings','DMP.AX':'Dominos Pizza',
  'DOW.AX':'Downer EDI','DRR.AX':'Deterra Royalties','EBO.AX':'Ebos Group',
  'ELD.AX':'Elders','ELO.AX':'Elmo Software','EMR.AX':'Emerald Resources',
  'EQR.AX':'EQT Holdings','EXP.AX':'Experience Co','FCL.AX':'Fineos Corp',
  'FLT.AX':'Flight Centre','FPH.AX':'Fisher & Paykel','GDF.AX':'GDI Property',
  'GEM.AX':'G8 Education','GNE.AX':'Genesis Energy','GOZ.AX':'Growthpoint Properties',
  'GQG.AX':'GQG Partners','GUD.AX':'GUD Holdings','GWA.AX':'GWA Group',
  'HLI.AX':'Helia Group','HLS.AX':'Healius','HMC.AX':'HMC Capital',
  'HSN.AX':'Hansen Technologies','HUB.AX':'Hub24','HVN.AX':'Harvey Norman',
  'IFL.AX':'Insignia Financial','IGO.AX':'IGO Limited','ILU.AX':'Iluka Resources',
  'IMD.AX':'Imdex','INA.AX':'Ingenia Communities','INR.AX':'INR Energy',
  'IOO.AX':'iShares Global 100','IPH.AX':'IPH Limited','IVC.AX':'InvoCare',
  'JBH.AX':'JB Hi-Fi','JDO.AX':'Judo Capital','JHG.AX':'Janus Henderson',
  'KAR.AX':'Karoon Energy','KGN.AX':'Kogan.com','KLS.AX':'Kelsian Group',
  'LFG.AX':'Liberty Financial','LGI.AX':'LGI Limited','LNK.AX':'Link Administration',
  'LOV.AX':'Lovisa Holdings','LYC.AX':'Lynas Rare Earths','MAF.AX':'MA Financial Group',
  'MCR.AX':'Mincor Resources','MEZ.AX':'Meridian Energy','MFG.AX':'Magellan Financial',
  'MGH.AX':'Maas Group','MHJ.AX':'Michael Hill','MMA.AX':'MMA Offshore',
  'MND.AX':'Monadelphous Group','MNF.AX':'MNF Group','MPB.AX':'Management Consulting',
  'MSB.AX':'Mesoblast','MTS.AX':'Metcash','MVF.AX':'Monash IVF',
  'MYX.AX':'Mayne Pharma','NAM.AX':'Namoi Cotton',
  // US Mega cap
  'AAPL':'Apple','NVDA':'NVIDIA','MSFT':'Microsoft','AMZN':'Amazon',
  'META':'Meta','GOOG':'Alphabet C','GOOGL':'Alphabet A','TSLA':'Tesla','BRK-B':'Berkshire B',
  'JPM':'JPMorgan','UNH':'UnitedHealth','V':'Visa','XOM':'ExxonMobil',
  'MA':'Mastercard','JNJ':'J&J','PG':'P&G','HD':'Home Depot',
  'AVGO':'Broadcom','MRK':'Merck','ABBV':'AbbVie','CVX':'Chevron',
  // S&P 500
  'BAC':'Bank of America','COST':'Costco','NFLX':'Netflix','CRM':'Salesforce',
  'AMD':'AMD','ADBE':'Adobe','TMO':'Thermo Fisher','ACN':'Accenture',
  'WFC':'Wells Fargo','LIN':'Linde','DHR':'Danaher','TXN':'Texas Instruments',
  'QCOM':'Qualcomm','MCD':'McDonalds','ABT':'Abbott','PM':'Philip Morris',
  'INTU':'Intuit','CAT':'Caterpillar','GS':'Goldman Sachs','MS':'Morgan Stanley',
  'BLK':'BlackRock','SPGI':'S&P Global','ISRG':'Intuitive Surgical',
  'RTX':'RTX Corp','AXP':'Amex','SYK':'Stryker','LOW':'Lowes',
  'VRTX':'Vertex Pharma','NOW':'ServiceNow',
  'PLD':'Prologis','NEE':'NextEra Energy',
  // NASDAQ 100
  'PYPL':'PayPal','CSCO':'Cisco','AMGN':'Amgen','AMAT':'Applied Materials','MU':'Micron',
  'LRCX':'Lam Research','PANW':'Palo Alto Networks','KLAC':'KLA Corp',
  'SNPS':'Synopsys','CDNS':'Cadence Design','MRVL':'Marvell Tech',
  'ABNB':'Airbnb','CRWD':'CrowdStrike','FTNT':'Fortinet','DXCM':'DexCom',
  'WDAY':'Workday','TEAM':'Atlassian','ORLY':'OReilly Auto','MNST':'Monster Beverage',
  'CSGP':'CoStar Group','CPRT':'Copart','IDXX':'IDEXX Labs','BIIB':'Biogen',
  'ILMN':'Illumina','PCAR':'PACCAR','ODFL':'Old Dominion','FAST':'Fastenal',
  'VRSK':'Verisk Analytics','ANSS':'ANSYS','CTSH':'Cognizant','DLTR':'Dollar Tree',
  'EA':'Electronic Arts','EXC':'Exelon','FANG':'Diamondback Energy','GFS':'GlobalFoundries',
  // Dow 30
  'BA':'Boeing','HON':'Honeywell','IBM':'IBM','TRV':'Travelers',
  'WMT':'Walmart','MMM':'3M','DIS':'Disney','KO':'Coca-Cola','VZ':'Verizon',
  'NKE':'Nike','DOW':'Dow Inc','WBA':'Walgreens','INTC':'Intel',
  // FTSE proxies (US-listed ADRs)
  'SHEL':'Shell','AZN':'AstraZeneca','HSBC':'HSBC','ULVR':'Unilever',
  'BP':'BP','RIO':'Rio Tinto ADR','GSK':'GSK','BBL':'BHP ADR',
  'DEO':'Diageo','LYG':'Lloyds','BCS':'Barclays','VOD':'Vodafone',
  'BTI':'BAT','NGG':'National Grid','PUK':'Prudential',
  // FTSE 100 — London-listed (.L)
  'HSBA.L':'HSBC Holdings','AZN.L':'AstraZeneca','VOD.L':'Vodafone','BA.L':'BAE Systems',
  'ULVR.L':'Unilever','SHEL.L':'Shell plc','RIO.L':'Rio Tinto','NG.L':'National Grid',
  'BHP.L':'BHP Group','DGE.L':'Diageo','LLOY.L':'Lloyds Banking','BARC.L':'Barclays',
  'BATS.L':'British American Tobacco','PRU.L':'Prudential','BP.L':'BP plc',
  'GSK.L':'GSK plc','ABF.L':'Associated British Foods','ANTO.L':'Antofagasta',
  'AUTO.L':'Auto Trader Group','AV.L':'Aviva','BKG.L':'Berkeley Group',
  'BNZL.L':'Bunzl','BRBY.L':'Burberry Group','CCH.L':'Coca-Cola HBC',
  'CNA.L':'Centrica','CPG.L':'Compass Group','CRDA.L':'Croda International',
  'EMG.L':'Man Group','EZJ.L':'EasyJet','SAGE.L':'Sage Group',
  'LAND.L':'Land Securities','RR.L':'Rolls-Royce','IMB.L':'Imperial Brands',
  'III.L':'3i Group','HLMA.L':'Halma','REL.L':'RELX','WPP.L':'WPP plc',
  'EXPN.L':'Experian','SKG.L':'Smurfit Kappa','LSEG.L':'London Stock Exchange',
  // DAX 40 — Frankfurt-listed (.DE)
  'SAP.DE':'SAP SE','SIE.DE':'Siemens','ALV.DE':'Allianz','MRK.DE':'Merck KGaA',
  'DTE.DE':'Deutsche Telekom','BAYN.DE':'Bayer AG','BMW.DE':'BMW AG',
  'MUV2.DE':'Munich Re','EOAN.DE':'E.ON SE','BAS.DE':'BASF SE',
  'RWE.DE':'RWE AG','HEN3.DE':'Henkel','VOW3.DE':'Volkswagen',
  'DBK.DE':'Deutsche Bank','FRE.DE':'Fresenius SE','MTX.DE':'MTU Aero Engines',
  'ADS.DE':'Adidas AG','BEI.DE':'Beiersdorf','CON.DE':'Continental AG',
  'DHL.DE':'Deutsche Post DHL','HEI.DE':'Heidelberg Materials','IFX.DE':'Infineon',
  'LIN.DE':'Linde plc','MBG.DE':'Mercedes-Benz','PUM.DE':'Puma SE',
  'QGEN.DE':'Qiagen','SHL.DE':'Siemens Healthineers','VNA.DE':'Vonovia SE',
  'ZAL.DE':'Zalando SE','DTG.DE':'Daimler Truck',
  // Nikkei 225 — Tokyo-listed (.T)
  '7203.T':'Toyota Motor','9984.T':'SoftBank Group','6861.T':'Keyence Corp',
  '8306.T':'Mitsubishi UFJ','6758.T':'Sony Group','9432.T':'NTT',
  '7974.T':'Nintendo','4519.T':'Chugai Pharmaceutical','8316.T':'Sumitomo Mitsui',
  '6367.T':'Daikin Industries','9433.T':'KDDI Corp','4523.T':'Eisai Co',
  '6501.T':'Hitachi Ltd','7267.T':'Honda Motor','8411.T':'Mizuho Financial',
  '9020.T':'East Japan Railway','4502.T':'Takeda Pharmaceutical','6902.T':'Denso Corp',
  '7751.T':'Canon Inc','8035.T':'Tokyo Electron','4063.T':'Shin-Etsu Chemical',
  '6954.T':'Fanuc Corp','7832.T':'Bandai Namco','8001.T':'Itochu Corp',
  '8031.T':'Mitsui & Co','9022.T':'Central Japan Railway','5108.T':'Bridgestone',
  '6645.T':'OMRON Corp','4568.T':'Daiichi Sankyo','6971.T':'Kyocera Corp',
  '2502.T':'Asahi Group','5020.T':'ENEOS Holdings','8801.T':'Mitsui Fudosan',
  // Hang Seng — Hong Kong-listed (.HK)
  '0700.HK':'Tencent Holdings','0941.HK':'China Mobile','1299.HK':'AIA Group',
  '0005.HK':'HSBC Holdings','0939.HK':'CCB','2318.HK':'Ping An Insurance',
  '1398.HK':'ICBC','3988.HK':'Bank of China','0388.HK':'HKEX',
  '2628.HK':'China Life Insurance','0883.HK':'CNOOC Ltd','1109.HK':'China Resources Land',
  '0016.HK':'Sun Hung Kai Properties','0011.HK':'Hang Seng Bank',
  '0688.HK':'China Overseas Land','1038.HK':'CKI Holdings',
  '0002.HK':'CLP Holdings','0003.HK':'HK & China Gas','0012.HK':'Henderson Land',
  '0017.HK':'New World Development','0066.HK':'MTR Corporation',
  '0101.HK':'Hang Lung Properties','0151.HK':'Want Want China',
  '0175.HK':'Geely Automobile','0267.HK':'CITIC Ltd',
  '9988.HK':'Alibaba Group','9618.HK':'JD.com','9999.HK':'NetEase',
  '1088.HK':'China Shenhua Energy','0291.HK':'China Resources Beer',
  // NZX 50 — New Zealand-listed (.NZ)
  'FPH.NZ':'Fisher & Paykel Healthcare','ATM.NZ':'A2 Milk Co',
  'SKC.NZ':'SkyCity Entertainment','MEL.NZ':'Meridian Energy NZ',
  'CEN.NZ':'Contact Energy','SPK.NZ':'Spark NZ','RYM.NZ':'Ryman Healthcare',
  'IFT.NZ':'Infratil','AIA.NZ':'Auckland International Airport',
  'PCT.NZ':'Precinct Properties','PFI.NZ':'Property For Industry',
  'GNE.NZ':'Genesis Energy NZ','VHP.NZ':'Vital Healthcare Property',
  'ARG.NZ':'Argosy Property','EBO.NZ':'EBOS Group',
  'KMD.NZ':'Kathmandu Holdings','MFT.NZ':'Mainfreight',
  'OCA.NZ':'Oceania Healthcare','SUM.NZ':'Summerset Group',
  'WHS.NZ':'The Warehouse Group','AIR.NZ':'Air New Zealand',
  'HGH.NZ':'Heartland Group','MHJ.NZ':'Michael Hill International',
  'NPX.NZ':'NZX Limited','NZR.NZ':'New Zealand Refining',
  // Shanghai Composite — A-shares (.SS)
  '601398.SS':'ICBC','601288.SS':'Agricultural Bank of China',
  '600519.SS':'Kweichow Moutai','601628.SS':'China Life Insurance',
  '601318.SS':'Ping An Insurance','600036.SS':'China Merchants Bank',
  '601166.SS':'Industrial Bank','600276.SS':'Jiangsu Hengrui Medicine',
  '601601.SS':'China Pacific Insurance','600900.SS':'Yangtze Power',
  '601088.SS':'China Shenhua Energy','600028.SS':'Sinopec',
  '601669.SS':'Power Construction Corp','601328.SS':'Bank of Communications',
  '600104.SS':'SAIC Motor','601186.SS':'China Railway Construction',
  '600048.SS':'Poly Developments','601211.SS':'Guotai Junan Securities',
  '601390.SS':'China Railway Group','688981.SS':'SMIC',
  '601728.SS':'China Telecom',
  // ASX additional
  'ACF.AX':'Acrow Formwork','ADD.AX':'Adslot Media','ALK.AX':'Alkane Resources',
  'DUG.AX':'DUG Technology','GNG.AX':'GR Engineering Services','MRM.AX':'MMA Offshore',
  'MTO.AX':'Motorcycle Holdings','NCK.AX':'Nick Scali','NHF.AX':'nib Holdings',
  'NUF.AX':'Nufarm','NWH.AX':'NRW Holdings','OFX.AX':'OFX Group',
  'ORA.AX':'Orora','PAC.AX':'Pacific Current Group','PDL.AX':'Pendal Group',
  'PGH.AX':'Pact Group','PME.AX':'Pro Medicus','PNI.AX':'Pinnacle Investment',
  'PPT.AX':'Perpetual','PTM.AX':'Platinum Asset Mgmt','QAN.AX':'Qantas Airways',
  'RHC.AX':'Ramsay Health Care','RWC.AX':'Reliance Worldwide','S32.AX':'South32',
  'SAR.AX':'Saracen Mineral','SDR.AX':'SiteMinder','SEK.AX':'Seek',
  'SGM.AX':'Sims Limited','SIG.AX':'Sigma Healthcare','SOL.AX':'Washington H Soul',
  'SPK.AX':'Spark Infrastructure','SSM.AX':'Service Stream','SVW.AX':'Seven Group',
  'SWM.AX':'Seven West Media','TIE.AX':'Tietto Minerals','TNE.AX':'Technology One',
  'TPG.AX':'TPG Telecom','TYR.AX':'Tyro Payments','WAF.AX':'West African Resources',
  'WAM.AX':'WAM Capital','WEB.AX':'Webjet','WOR.AX':'Worley','YAL.AX':'Yancoal',
  // S&P 500 additional
  'LLY':'Eli Lilly','NVO':'Novo Nordisk','PEP':'PepsiCo','GE':'GE Aerospace',
  'BKNG':'Booking Holdings','TJX':'TJX Companies','GILD':'Gilead Sciences',
  'ELV':'Elevance Health','MDT':'Medtronic','SCHW':'Charles Schwab',
  'UPS':'UPS','DE':'Deere & Company','ADI':'Analog Devices','C':'Citigroup',
  'ETN':'Eaton Corp','ZTS':'Zoetis','BSX':'Boston Scientific',
  'MMC':'Marsh & McLennan','CB':'Chubb','SO':'Southern Company','DUK':'Duke Energy',
  'ITW':'Illinois Tool Works','AON':'Aon plc','SLB':'SLB','CME':'CME Group',
  'USB':'US Bancorp','CL':'Colgate-Palmolive','HCA':'HCA Healthcare',
  'TGT':'Target Corp','FI':'Fiserv','MCO':'Moodys Corp','AMT':'American Tower',
  'CCI':'Crown Castle','PSA':'Public Storage','REGN':'Regeneron',
  // DAX 40 additional
  'ENR.DE':'Siemens Energy','EVK.DE':'Evonik Industries','FNTN.DE':'Freenet AG',
  'HFG.DE':'HelloFresh','MAN.DE':'MAN SE','PAH3.DE':'Porsche Automobil Holding',
  'RHM.DE':'Rheinmetall','SRT3.DE':'Sartorius AG','SY1.DE':'Symrise','TKA.DE':'Thyssenkrupp',
  // Nikkei 225 additional
  '1925.T':'Daiwa House Industry','2503.T':'Kirin Holdings','3382.T':'Seven & i Holdings',
  '4543.T':'Terumo Corp','5401.T':'Nippon Steel','6098.T':'Recruit Holdings',
  '6146.T':'Disco Corp','6273.T':'SMC Corp','6301.T':'Komatsu Ltd',
  '6326.T':'Kubota Corp','6471.T':'NSK Ltd','6503.T':'Mitsubishi Electric',
  '6702.T':'Fujitsu Ltd','6723.T':'Renesas Electronics','6752.T':'Panasonic Holdings',
  '6762.T':'TDK Corp','6857.T':'Advantest Corp','6869.T':'Sysmex Corp',
  '6920.T':'Lasertec Corp','7011.T':'Mitsubishi Heavy Ind','7733.T':'Olympus Corp',
  '7741.T':'Hoya Corp','7762.T':'Citizen Watch',
  // FTSE 100 additional
  'FERG.L':'Ferguson plc','FLTR.L':'Flutter Entertainment','GLEN.L':'Glencore',
  'HIK.L':'Hikma Pharmaceuticals','HL.L':'Hargreaves Lansdown','IAG.L':'IAG',
  'IHG.L':'InterContinental Hotels','ITV.L':'ITV plc','JD.L':'JD Sports Fashion',
  'KGF.L':'Kingfisher plc','LGEN.L':'Legal & General','MKS.L':'Marks & Spencer',
  'MNDI.L':'Mondi plc','MNG.L':'M&G plc','MRO.L':'Melrose Industries',
  'MTO.L':'Mitie Group','NWG.L':'NatWest Group','NXT.L':'Next plc',
  'OCDO.L':'Ocado Group','PFC.L':'Petrofac','PSON.L':'Pearson plc',
  'PSN.L':'Persimmon plc','PHNX.L':'Phoenix Group','RKT.L':'Reckitt Benckiser',
  'RMG.L':'Royal Mail','SBRY.L':'Sainsburys','SDR.L':'Schroders plc',
  'SGE.L':'Sage Group','SGRO.L':'SEGRO plc','SMT.L':'Scottish Mortgage',
  'SN.L':'Smith & Nephew','SSE.L':'SSE plc','STAN.L':'Standard Chartered',
  'SVT.L':'Severn Trent','TSCO.L':'Tesco plc','UU.L':'United Utilities',
  'VTY.L':'Vistry Group','WEIR.L':'Weir Group','AAF.L':'Airtel Africa',
  'AAL.L':'Anglo American','ADM.L':'Admiral Group','AGK.L':'Aggreko',
  'AHT.L':'Ashtead Group','AIBG.L':'AIB Group','AML.L':'Aston Martin',
  'DCC.L':'DCC plc','HMS.L':'Hammerson','INF.L':'Informa plc',
  'MGG.L':'MGM Growth Properties','PHX.L':'Phoenix Spree Deutschland',
  'RSA.L':'RSA Insurance','SPX.L':'Spirax-Sarco Engineering','STJ.L':'St James Place',
  'TUI.L':'TUI AG','WG.L':'John Wood Group','WHP.L':'Wetherspoon',
  'WMH.L':'William Hill','WTB.L':'Whitbread',
  // Hang Seng additional
  '0288.HK':'WH Group','0316.HK':'Orient Overseas Int','0322.HK':'Tingyi Holding',
  '0386.HK':'Sinopec Corp','0669.HK':'Techtronic Industries','0762.HK':'China Unicom',
  '0823.HK':'Link REIT','0857.HK':'PetroChina','0868.HK':'Xinyi Glass',
  '0960.HK':'Longfor Group','0981.HK':'SMIC','1044.HK':'Hengan International',
  '1093.HK':'CSPC Pharmaceutical','1177.HK':'Sino Biopharmaceutical','1211.HK':'BYD Company',
  '1928.HK':'Sands China','2007.HK':'Country Garden','2020.HK':'ANTA Sports',
  '2269.HK':'WuXi Biologics','2313.HK':'Shenzhou International','2382.HK':'Sunny Optical',
  '2388.HK':'BOC Hong Kong',
  // NZX 50 additional
  'ANZ.NZ':'ANZ Bank NZ','BIT.NZ':'Bigtincan Holdings','CVT.NZ':'Comvita',
  'DGL.NZ':'DGL Group','ERD.NZ':'Erris Resources','FBU.NZ':'Fletcher Building',
  'FSF.NZ':'Fonterra Shareholders Fund','GTK.NZ':'Gentrack Group','IKE.NZ':'ikeGPS Group',
  'IPL.NZ':'Investore Property','MCK.NZ':'Millennium & Copthorne Hotels',
  'MWE.NZ':'Manawa Energy','NZS.NZ':'New Zealand Steel','PEB.NZ':'Pacific Edge',
  'POT.NZ':'Port of Tauranga','RAK.NZ':'Rakon','SCL.NZ':'Scales Corporation',
  'SEK.NZ':'Seeka','SKL.NZ':'Skellerup Holdings','STU.NZ':'Steel & Tube',
  'TLT.NZ':'Tilt Renewables',
  // Shanghai additional
  '600000.SS':'Shanghai Pudong Development Bank','600016.SS':'China Minsheng Banking',
  '600019.SS':'Baoshan Iron & Steel','600031.SS':'Sany Heavy Industry',
  '600050.SS':'China United Network Comms','600089.SS':'TBEA Co',
  '600196.SS':'Fosun Pharmaceutical','600309.SS':'Wanhua Chemical',
  '600340.SS':'China Fortune Land Dev','600406.SS':'NARI Technology',
  '600436.SS':'Zhangjiajie Tourism','600438.SS':'Tongwei Co',
  '600547.SS':'Shandong Gold Mining','600570.SS':'Hundsun Technologies',
  '600585.SS':'Anhui Conch Cement','600588.SS':'Yonyou Network Technology',
  '600600.SS':'Tsingtao Brewery','600690.SS':'Haier Smart Home',
  '600703.SS':'Sanan Optoelectronics','600745.SS':'Will Semiconductor',
  '600809.SS':'Shanxi Fenjiu','600837.SS':'Haitong Securities',
  '600887.SS':'Inner Mongolia Yili','600999.SS':'Zhaojin Mining',
  '601006.SS':'Daqin Railway','601012.SS':'Longi Green Energy',
  '601066.SS':'CITIC Securities','601155.SS':'Seazen Group',
  '601229.SS':'Shanghai Rural Commercial Bank','601336.SS':'New China Life Insurance',
}

const INDEX_LABELS = {
  '^AXJO':'ASX 200','^AORD':'All Ords','^GSPC':'S&P 500','^IXIC':'NASDAQ 100',
  '^DJI':'Dow Jones 30','^FTSE':'FTSE 100','^N225':'Nikkei 225',
  '^GDAXI':'DAX 40','^HSI':'Hang Seng','^NZ50':'NZX 50','000001.SS':'Shanghai',
}

// Display denominator in loading indicator — reflects the index size, not just our symbol list
const INDEX_EXPECTED_COUNT = {
  '^AXJO':200,'^AORD':500,'^GSPC':100,'^IXIC':100,'^DJI':30,
  '^FTSE':100,'^GDAXI':40,'^N225':50,'^HSI':50,'^NZ50':50,'000001.SS':50,
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

// Approximate weights for ASX 200 top 20
const ASX_WEIGHTS = {
  'BHP.AX':10.2,'CBA.AX':8.9,'CSL.AX':5.1,'ANZ.AX':3.2,'NAB.AX':3.8,
  'WBC.AX':3.1,'WES.AX':3.5,'MQG.AX':3.2,'WOW.AX':2.1,'RIO.AX':2.9,
  'GMG.AX':2.6,'FMG.AX':1.8,'TLS.AX':1.7,'REA.AX':1.5,'ALL.AX':1.4,
  'MIN.AX':0.8,'STO.AX':0.9,'WDS.AX':1.2,'AGL.AX':0.5,'NEM.AX':0.9,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Smooth continuous gradient: deep red → neutral navy → deep green, clamped
// to ±3%. Used for the heatmap tiles.
const HEAT_RED     = [168, 50, 50]   // #A83232
const HEAT_NEUTRAL = [26, 47, 74]    // #1A2F4A
const HEAT_GREEN    = [45, 138, 80]  // #2D8A50
function lerp(a, b, t) { return a + (b - a) * t }
function rgbToCss([r, g, b], alpha = 1) { return `rgba(${r},${g},${b},${alpha})` }
function pctToHeatGradient(pct) {
  if (pct == null) return rgbToCss(HEAT_NEUTRAL, 0.55)
  const clamped = Math.max(-3, Math.min(3, pct))
  const t = Math.abs(clamped) / 3 // 0 (neutral) .. 1 (full colour)
  const stop = clamped >= 0 ? HEAT_GREEN : HEAT_RED
  const rgb = [
    lerp(HEAT_NEUTRAL[0], stop[0], t),
    lerp(HEAT_NEUTRAL[1], stop[1], t),
    lerp(HEAT_NEUTRAL[2], stop[2], t),
  ].map(Math.round)
  return rgbToCss(rgb, 0.85)
}

function displaySym(yahoo) {
  return yahoo.replace(/\.(AX|L|DE|T|HK|NZ|SS)$/i, '').toUpperCase()
}

// Convert a native-currency price to AUD.
// rates from fetchFxRates('AUD') = { USD, GBP, EUR, JPY, HKD, NZD, CNY, ... }
// Each value = units of that currency per 1 AUD (e.g. GBP: 0.51 means £0.51 = A$1)
function nativeToAud(price, currency, rates) {
  if (price == null || !rates) return null
  if (!currency || currency === 'AUD') return price
  // GBp (pence) = 1/100 GBP — Yahoo Finance reports many LSE stocks in pence
  if (currency === 'GBp') return (price / 100) / (rates.GBP ?? 0.512)
  const rate = rates[currency]
  if (!rate) return null
  return price / rate
}

function SortIcon({ col, current, dir }) {
  if (col !== current) return <span className="text-terminal-border ml-1">↕</span>
  return <span className="text-terminal-gold ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <div className="text-terminal-text-dim">{label}</div>
      <div className="text-terminal-gold font-semibold">{fmt.price(payload[0].value)}</div>
    </div>
  )
}

// Sector-composite chart tooltip — shows the equal-weighted % change across
// constituent stocks, not a single dollar price.
function CompositeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  const color = v >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
  return (
    <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
      <div className="text-terminal-text-dim">{label}</div>
      <div className="font-semibold" style={{ color }}>Sector: {v >= 0 ? '+' : ''}{v.toFixed(1)}%</div>
    </div>
  )
}

// Calculate % change over N trading days back from history array
function calcHistChange(hist, daysBack) {
  const arr = Array.isArray(hist) ? hist.filter(d => d?.price != null && !isNaN(d.price)) : []
  if (arr.length < 2) return null
  const cur = arr[arr.length - 1].price
  const ref = arr[Math.max(0, arr.length - 1 - daysBack)].price
  if (!ref || ref === 0) return null
  return (cur - ref) / ref * 100
}

// Calculate YTD change from history.
// Bug: `d.date` is a display label like "5 Jan" with no year — new Date("5 Jan")
// resolves to 2001, never >= yearStart, so startEntry was always undefined and
// this always returned null. Use `d.rawDate` (ISO "YYYY-MM-DD") instead.
function calcYTDChange(hist) {
  const arr = Array.isArray(hist) ? hist.filter(d => d?.price != null && !isNaN(d.price)) : []
  if (arr.length < 2) return null
  const yearStart = new Date(new Date().getFullYear(), 0, 1)
  const cur = arr[arr.length - 1].price
  const startEntry = arr.find(d => {
    const key = d.rawDate ?? d.date
    if (!key) return false
    const dt = new Date(key)
    return !isNaN(dt) && dt >= yearStart
  })
  if (!startEntry?.price) return null
  return (cur - startEntry.price) / startEntry.price * 100
}

// Maps the period selector (5D/1M/3M/YTD/1Y) to Yahoo Finance range+interval
// params for the sector detail chart. 5D uses an intraday interval since a
// daily-interval fetch over only 5 days would be too sparse to chart.
function periodToYFParams(period) {
  switch (period) {
    case '7D':  return { range: '7d',  interval: '1d'  }
    case '1M':  return { range: '1mo', interval: '1d'  }
    case '3M':  return { range: '3mo', interval: '1d'  }
    case 'YTD': return { range: 'ytd', interval: '1d'  }
    case '1Y':  return { range: '1y',  interval: '1d'  }
    default:    return { range: '1mo', interval: '1d'  }
  }
}

// ─── Toggle components ────────────────────────────────────────────────────────

function ViewToggle({ view, setView }) {
  return (
    <div className="flex gap-0 border border-terminal-gold/30">
      {[['sectors','SECTORS VIEW'],['index','INDEX VIEW'],['correlation','CORRELATION']].map(([v, label]) => (
        <button
          key={v}
          onClick={() => {
            setView(v)
            try { localStorage.setItem('madden_mkt_view', v) } catch {}
          }}
          className={`px-3 py-1 text-2xs font-bold transition-colors duration-150 ${
            view === v
              ? 'bg-terminal-gold text-terminal-bg'
              : 'bg-terminal-bg text-terminal-gold border-l border-terminal-gold/30 first:border-l-0 hover:bg-terminal-gold/10'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function MetricToggle({ metric, setMetric }) {
  return (
    <div className="flex gap-0 border border-terminal-gold/20">
      {['7D','1M','YTD'].map(val => (
        <button
          key={val}
          onClick={() => setMetric(val)}
          className={`px-2 py-1 text-2xs font-bold transition-colors border-r border-terminal-gold/15 last:border-0 ${
            metric === val
              ? 'bg-terminal-gold/20 text-terminal-gold'
              : 'text-terminal-text-dim hover:text-terminal-gold'
          }`}
        >
          {val}
        </button>
      ))}
    </div>
  )
}

// ─── Sectors View ─────────────────────────────────────────────────────────────

function SectorsView({ sectorConfig, proxyQuotes, histData, secondaryMetric, isFetching, isError, refetch, selectedIndex, openModal }) {
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [view3D, setView3D] = useState(false)
  const { canAccess, tier } = useSubscription()

  // Listen for sector-select events from SectorStrengthRadar
  useEffect(() => {
    const handler = (e) => {
      const name = e.detail?.sectorName
      if (name) setSelected(name)
    }
    window.addEventListener('madden:sector-select', handler)
    return () => window.removeEventListener('madden:sector-select', handler)
  }, [])

  const isASX = selectedIndex === '^AXJO' || selectedIndex === '^AORD'
  const constituentStocks = selected && isASX ? (ASX_SECTOR_STOCKS[selected] ?? []) : []
  const constituentSyms = constituentStocks.map(([s]) => s)

  const { data: constQuotes, isFetching: constFetching } = useQuery({
    queryKey: ['yahooBatch', 'sectorConst', selectedIndex, selected],
    queryFn:  () => fetchYahooBatch(constituentSyms),
    enabled:  constituentSyms.length > 0,
    staleTime: 60_000,
    retry: 1,
  })

  // Every constituent across every sector, fetched once so each tile can show
  // its own ▲up/▼down breadth without a per-tile query. ASX-only — non-ASX
  // indices only have a single proxy stock per sector (no constituent list).
  const allConstituentSyms = useMemo(
    () => isASX ? [...new Set(Object.values(ASX_SECTOR_STOCKS).flat().map(([s]) => s))] : [],
    [isASX]
  )
  const { data: allConstQuotes } = useQuery({
    queryKey: ['yahooBatch', 'sectorConstAll', selectedIndex],
    queryFn:  () => fetchYahooBatch(allConstituentSyms),
    enabled:  allConstituentSyms.length > 0,
    staleTime: 60_000,
    retry: 1,
  })
  function breadthFor(sectorName) {
    if (!allConstQuotes) return null
    const syms = (ASX_SECTOR_STOCKS[sectorName] ?? []).map(([s]) => s)
    if (!syms.length) return null
    const quotes = syms.map(s => allConstQuotes[s]).filter(Boolean)
    if (!quotes.length) return null
    return {
      up:   quotes.filter(q => q.pct > 0).length,
      down: quotes.filter(q => q.pct < 0).length,
    }
  }

  // Proxy stock 1-month chart — used directly for non-ASX indices (which only
  // have a single proxy per sector), and as a fallback for ASX sectors if the
  // composite below can't be built from enough constituent stocks.
  const proxySym = selected ? (sectorConfig[selected]?.sym ?? null) : null
  const useComposite = isASX && constituentSyms.length > 1

  // Sector composite — equal-weighted average % change across every
  // constituent stock, fetched in parallel. Promise.allSettled means a
  // handful of failed symbols don't take down the whole composite.
  const { data: compositeRaw, isFetching: compositeFetching } = useQuery({
    queryKey: ['sectorComposite', selectedIndex, selected, constituentSyms.join(','), secondaryMetric],
    queryFn: async () => {
      const { range, interval } = periodToYFParams(secondaryMetric)
      const settled = await Promise.allSettled(
        constituentSyms.map(sym => fetchYFHistory(sym, { range, interval }))
      )
      return settled.map((r) => r.status === 'fulfilled' ? transformYFHistory(r.value) : [])
    },
    enabled: useComposite,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const composite = useMemo(() => {
    if (!useComposite || !compositeRaw) return null
    const perStock = compositeRaw
      .map((data) => data.filter(d => d && d.price != null && !isNaN(d.price)))
      .filter(arr => arr.length >= 2)
    if (perStock.length < 2) return null

    // Normalise each stock to % change from its own first data point in the period
    const normalised = perStock.map(arr => {
      const first = arr[0].price
      return arr.map(d => ({ key: d.rawDate ?? d.date, label: d.date, pct: (d.price / first - 1) * 100 }))
    })

    // Average pct across stocks for each date, requiring at least 50% coverage
    const byDate = new Map()
    for (const series of normalised) {
      for (const point of series) {
        if (!byDate.has(point.key)) byDate.set(point.key, { label: point.label, vals: [] })
        byDate.get(point.key).vals.push(point.pct)
      }
    }
    const minCoverage = Math.ceil(perStock.length / 2)
    const points = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([, { vals }]) => vals.length >= minCoverage)
      .map(([, { label, vals }]) => ({
        date: label,
        pct: vals.reduce((s, v) => s + v, 0) / vals.length,
      }))

    return points.length >= 2 ? { points, stockCount: perStock.length } : null
  }, [compositeRaw, useComposite])

  const compositeAttempted   = useComposite && !compositeFetching && compositeRaw != null
  const compositeUnavailable = compositeAttempted && composite == null

  // Single-stock fallback: always fetched for non-composite indices, or once
  // the composite has been tried and come up short (< 2 usable stocks).
  const { data: rawHistory, isFetching: histFetching } = useQuery({
    queryKey: ['yfHistory', proxySym, secondaryMetric],
    queryFn:  () => fetchYFHistory(proxySym, periodToYFParams(secondaryMetric)),
    enabled:  !!proxySym && (!useComposite || compositeUnavailable),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const chartData = useMemo(() => {
    const raw = rawHistory ? transformYFHistory(rawHistory) : []
    return raw.filter(d => d && d.price != null && !isNaN(d.price))
  }, [rawHistory, proxySym])

  const constArr = constQuotes ? Object.values(constQuotes) : []
  const upCount   = constArr.filter(q => q.pct > 0).length
  const downCount = constArr.filter(q => q.pct < 0).length

  const isLive = !!proxyQuotes && !isError
  const updatedTime = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  const indexLabel = INDEX_LABELS[selectedIndex] ?? 'Index'

  function getSecondaryChange(sym) {
    const hist = histData?.[sym]
    if (!hist?.length) return null
    if (secondaryMetric === '7D')  return calcHistChange(hist, 5)
    if (secondaryMetric === '1M')  return calcHistChange(hist, 21)
    if (secondaryMetric === 'YTD') return calcYTDChange(hist)
    return null
  }

  const askAISector = (sectorOverride) => {
    const sec = sectorOverride ?? selected
    const sym = sectorOverride ? (sectorConfig[sectorOverride]?.sym ?? null) : proxySym
    if (!sec || !sym) return
    const q = proxyQuotes?.[sym]
    const ticker = sym.replace('.AX', '').replace('.L', '')
    dispatchAskAI({
      name:        `${sec} Sector`,
      ticker,
      exchange:    indexLabel,
      price:       q?.price != null ? `${q.currency === 'AUD' ? 'A$' : q.currency ? `${q.currency} ` : ''}${fmt.price(q.price)}` : null,
      change:      q?.pct != null ? `${q.pct >= 0 ? '+' : ''}${q.pct.toFixed(2)}%` : null,
      sector:      sec,
      date:        todayAEST(),
      instruction: `Analyse the ${sec} sector for ${indexLabel} performance today, using proxy stock ${ticker}. Key drivers, sector outlook, and implications for investors.`,
    })
  }

  const { addAlert } = useStore()
  const [contextMenu, setContextMenu] = useState(null) // { x, y, sector }
  const handleSectorContextMenu = (e, sector) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, sector })
  }
  const closeContextMenu = () => setContextMenu(null)
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    const onEsc = (e) => { if (e.key === 'Escape') setContextMenu(null) }
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onEsc)
    }
  }, [contextMenu])

  return (
    <div className="flex flex-col">
      {/* Breadcrumb / status bar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-terminal-border flex-shrink-0 bg-terminal-header">
        <span className="text-2xs font-bold text-terminal-text-dim tracking-wider">
          SHOWING {indexLabel.toUpperCase()} SECTORS
        </span>
        {isFetching && <span className="text-2xs text-terminal-text-dim animate-pulse">LOADING...</span>}
        {isLive && (USING_MOCK_DATA ? <DemoBadge /> : <span className="text-terminal-green text-2xs">● LIVE {updatedTime}</span>)}
        {isError && !isFetching && (
          <button onClick={refetch} className="text-2xs text-terminal-red hover:text-terminal-gold">⚠ RETRY</button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center border border-terminal-border rounded-full overflow-hidden">
            <button
              onClick={() => setView3D(false)}
              className={`text-2xs px-2.5 py-0.5 font-bold transition-colors ${!view3D ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
            >2D</button>
            <button
              onClick={() => setView3D(true)}
              className={`text-2xs px-2.5 py-0.5 font-bold transition-colors ${view3D ? 'bg-terminal-gold text-terminal-bg' : 'text-terminal-text-dim hover:text-terminal-gold'}`}
            >3D</button>
          </div>
          {selected && (
            <button onClick={() => setSelected(null)} className="text-2xs text-terminal-text-dim hover:text-terminal-gold">
              CLOSE ✕
            </button>
          )}
        </div>
      </div>

      {view3D ? (
        <div style={{ height: 460 }} className="flex-shrink-0">
          <SectorLandscape3D
            sectors={GICS_SECTORS
              .filter((s) => sectorConfig[s]?.sym)
              .map((s) => ({
                name: s,
                abbr: SECTOR_ABBR[s],
                pct: proxyQuotes?.[sectorConfig[s].sym]?.pct ?? 0,
                marketCap: proxyQuotes?.[sectorConfig[s].sym]?.marketCap ?? null,
              }))}
          />
        </div>
      ) : (
      <div className="flex">
        {/* Heatmap grid */}
        <div className={`p-2 transition-all duration-150 ${selected ? 'w-[55%]' : 'w-full'}`}>
          <div
            className={`grid gap-1.5 ${selected ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-3 xl:grid-cols-6'}`}
            style={{ gridAutoFlow: 'dense' }}
          >
            {(() => {
              // Tile size proportional to sector market cap (proxy stock's
              // own marketCap stands in for sector-level cap, same "GICS
              // proxy" approximation the rest of this view already uses).
              // grid-auto-flow:dense packs smaller tiles into any gaps a
              // spanned tile leaves, so this reads as a loose treemap
              // without needing a real treemap layout engine.
              const caps = GICS_SECTORS
                .map(s => proxyQuotes?.[sectorConfig[s]?.sym]?.marketCap)
                .filter(c => c != null)
              const maxCap = caps.length ? Math.max(...caps) : null
              const sizeTierFor = (cap) => {
                if (cap == null || !maxCap) return { col: 'col-span-1', row: 'row-span-1' }
                const ratio = cap / maxCap
                if (ratio >= 0.65) return { col: 'col-span-2', row: 'row-span-2' }
                if (ratio >= 0.3)  return { col: 'col-span-2', row: 'row-span-1' }
                return { col: 'col-span-1', row: 'row-span-1' }
              }

              return GICS_SECTORS.map((sector) => {
              const cfg = sectorConfig[sector]
              const isSelected = selected === sector
              const isHovered  = hovered === sector

              // N/A tile for sectors not in this index
              if (!cfg) {
                return (
                  <div
                    key={sector}
                    className="p-2 select-none flex flex-col gap-0.5"
                    style={{
                      backgroundColor: 'rgba(20,40,70,0.12)',
                      border: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    <div className="text-2xs font-bold text-terminal-text-dim/35 tracking-wider truncate">
                      {SECTOR_ABBR[sector]}
                    </div>
                    <div className="text-sm font-bold text-terminal-text-dim/20">N/A</div>
                    <div className="text-2xs text-terminal-text-dim/18" style={{ fontSize: '9px' }}>Not in index</div>
                  </div>
                )
              }

              const q = proxyQuotes?.[cfg.sym] ?? null
              const pct = q?.pct ?? null
              const bg = pctToHeatGradient(pct)
              const text = pct == null ? 'var(--color-neutral)' : pct >= 0 ? 'var(--color-gain-bright)' : 'var(--color-loss-bright)'
              const arrow = pct == null ? '' : pct >= 0 ? '▲' : '▼'
              const secChange = getSecondaryChange(cfg.sym)
              const secColor = secChange == null
                ? 'rgba(156,163,175,0.4)'
                : secChange >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
              const breadth = breadthFor(sector)
              const { col, row } = sizeTierFor(q?.marketCap)
              const chipStocks = (ASX_SECTOR_STOCKS[sector] ?? []).slice(0, 5)

              return (
                <div
                  key={sector}
                  className={`relative p-2 cursor-pointer select-none transition-all duration-150 flex flex-col ${col} ${row}`}
                  style={{
                    backgroundColor: bg,
                    border: isSelected ? '2px solid #c8a84b' : '1px solid rgba(255,255,255,0.06)',
                    filter: isHovered ? 'brightness(1.25)' : '',
                    boxShadow: isSelected ? '0 0 12px rgba(200,168,75,0.25)' : 'none',
                  }}
                  onMouseEnter={() => setHovered(sector)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(isSelected ? null : sector)}
                  onContextMenu={(e) => handleSectorContextMenu(e, sector)}
                >
                  {/* Top-left: abbreviated sector name */}
                  <div className="text-[8px] font-mono text-terminal-text-dim tracking-wider truncate leading-tight flex-shrink-0">
                    {SECTOR_ABBR[sector]}
                  </div>

                  {/* Dead centre: day change — primary metric */}
                  <div className="flex-1 flex items-center justify-center min-h-0">
                    <div className={row === 'row-span-2' ? 'text-xl font-bold leading-tight' : 'text-sm font-bold leading-tight'} style={{ color: text }}>
                      {pct != null
                        ? `${arrow} ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
                        : <span className="text-terminal-text-dim/40 text-xs animate-pulse">—</span>
                      }
                    </div>
                  </div>

                  {/* Bottom row: secondary metric (left) + breadth (bottom-right) */}
                  <div className="flex items-end justify-between flex-shrink-0 gap-1">
                    <span className="text-[8px] font-mono leading-tight" style={{ color: secColor, opacity: 0.85 }}>
                      {secChange != null
                        ? `${secChange >= 0 ? '+' : ''}${secChange.toFixed(1)}% ${secondaryMetric}`
                        : `— ${secondaryMetric}`
                      }
                    </span>
                    {breadth && (
                      <span className="text-[8px] font-mono leading-tight flex-shrink-0">
                        <span style={{ color: 'var(--color-gain)' }}>▲{breadth.up}</span>
                        {' '}
                        <span style={{ color: 'var(--color-loss)' }}>▼{breadth.down}</span>
                      </span>
                    )}
                  </div>

                  {/* Hover: constituent chips (ASX only — the only index with a
                      multi-stock constituent list per sector) */}
                  {isHovered && chipStocks.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {chipStocks.map(([sym]) => (
                        <span key={sym} className="text-[9px] px-1 py-0 bg-black/30 border border-white/10 text-terminal-text-dim rounded-sm">
                          {sym.replace('.AX', '')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
            })()}
            {/* filler to complete last grid row (11 sectors → 12 = clean 4-col or 3-col fill) */}
            <div style={{ height: 0, visibility: 'hidden', padding: 0, margin: 0 }} aria-hidden="true" />
          </div>
          <div className="text-2xs text-terminal-text-dim/50 text-center" style={{ marginTop: 8 }}>
            {isLive
              ? `GICS sector proxy prices · ${USING_MOCK_DATA ? 'DEMO DATA' : `Live · ${updatedTime} AEST`}`
              : 'Official GICS sectors · proxy stock prices · Click tile to drill down'}
          </div>

          {/* Sector rotation — today's move vs the period trend (secondaryMetric),
              sorted by day momentum. Sectors where the day bar runs well ahead of
              the period bar are accelerating; the reverse are cooling off. */}
          <div className="border-t border-terminal-border mt-2 pt-2">
            <div className="text-2xs text-terminal-text-dim uppercase tracking-wider mb-1.5">
              Sector Rotation · Day vs {secondaryMetric}
            </div>
            {(() => {
              const rows = GICS_SECTORS
                .map(sector => {
                  const cfg = sectorConfig[sector]
                  if (!cfg) return null
                  const day = proxyQuotes?.[cfg.sym]?.pct
                  const period = getSecondaryChange(cfg.sym)
                  if (day == null) return null
                  return { sector, day, period }
                })
                .filter(Boolean)
                .sort((a, b) => b.day - a.day)
              const maxAbs = Math.max(...rows.map(r => Math.abs(r.day)), ...rows.map(r => Math.abs(r.period ?? 0)), 0.1)
              // Rotation signal — ranked by the period (secondaryMetric)
              // change rather than today's move, since a single day's noise
              // isn't "rotation"; the strongest/weakest over the period are.
              const byPeriod = rows.filter(r => r.period != null).sort((a, b) => b.period - a.period)
              const strongest = byPeriod[0]
              const weakest = byPeriod[byPeriod.length - 1]
              const showRotation = strongest && weakest && strongest.sector !== weakest.sector && (strongest.period - weakest.period) > 1
              return (
                <div className="flex flex-col gap-1">
                  {showRotation && (
                    <div className="flex items-center gap-2 text-2xs px-2 py-1.5 mb-1 border border-terminal-gold/25 bg-terminal-gold/5 rounded">
                      <span className="text-terminal-red font-bold">{SECTOR_ABBR[weakest.sector]}</span>
                      <span className="text-terminal-gold">→</span>
                      <span className="text-terminal-green font-bold">{SECTOR_ABBR[strongest.sector]}</span>
                      <span className="text-terminal-text-dim ml-1">
                        rotation over {secondaryMetric} — money moving from weaker to stronger
                      </span>
                    </div>
                  )}
                  {rows.map(r => (
                    <div key={r.sector} className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-terminal-text-dim w-24 flex-shrink-0 truncate">{SECTOR_ABBR[r.sector]}</span>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div style={{ width: `${(Math.abs(r.day) / maxAbs) * 100}%`, height: '100%', background: r.day >= 0 ? '#3aaa63' : '#a83232' }} />
                        </div>
                        <span className={`w-14 text-right ${r.day >= 0 ? 'pos' : 'neg'}`}>{r.day >= 0 ? '+' : ''}{r.day.toFixed(2)}%</span>
                      </div>
                      <span className="text-terminal-text-dim/50 w-16 text-right">
                        {r.period != null ? `${r.period >= 0 ? '+' : ''}${r.period.toFixed(1)}% ${secondaryMetric}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Right-click context menu */}
          {contextMenu && (
            <div
              className="fixed z-50 bg-terminal-panel border border-terminal-border-gold shadow-lg py-1"
              style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 200 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setSelected(contextMenu.sector); closeContextMenu() }}
                className="w-full text-left px-3 py-1.5 text-2xs text-terminal-text hover:bg-terminal-surface2 hover:text-terminal-gold transition-colors"
              >View all stocks in {contextMenu.sector}</button>
              <button
                onClick={() => { askAISector(contextMenu.sector); closeContextMenu() }}
                className="w-full text-left px-3 py-1.5 text-2xs text-terminal-text hover:bg-terminal-surface2 hover:text-terminal-gold transition-colors"
              >Ask MaddenAI about {contextMenu.sector}</button>
              <button
                onClick={() => {
                  const sym = sectorConfig[contextMenu.sector]?.sym
                  const q = sym ? proxyQuotes?.[sym] : null
                  const target = window.prompt(`Alert on ${sym ?? contextMenu.sector} (sector proxy) when price reaches:`, q?.price != null ? q.price.toFixed(2) : '')
                  if (target && !isNaN(parseFloat(target)) && sym) {
                    addAlert(sym, target, q?.price != null && parseFloat(target) < q.price ? 'below' : 'above')
                  }
                  closeContextMenu()
                }}
                className="w-full text-left px-3 py-1.5 text-2xs text-terminal-text hover:bg-terminal-surface2 hover:text-terminal-gold transition-colors"
              >Set sector alert</button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && sectorConfig[selected] && (
          <div className="w-[45%] border-l border-terminal-border flex flex-col panel-fade relative">
            <div className="panel-header flex items-center gap-2 flex-shrink-0">
              <span className="text-terminal-gold truncate text-xs">{selected.toUpperCase()}</span>
              {constFetching && <span className="text-2xs text-terminal-text-dim font-normal animate-pulse">LOADING...</span>}
              {constQuotes && !constFetching && (USING_MOCK_DATA ? <DemoBadge /> : <span className="text-terminal-green text-2xs font-normal">● LIVE</span>)}
              <button
                onClick={askAISector}
                className="ml-auto text-2xs border border-terminal-gold/40 text-terminal-gold/70 hover:border-terminal-gold hover:text-terminal-gold px-1.5 py-0.5 transition-colors"
              >
                AI ▶
              </button>
            </div>

            {!canAccess('prime') ? (
              <UpgradePrompt feature="Sector Detail View" requiredTier="prime" currentTier={tier} />
            ) : (
            <>
            {/* Proxy summary */}
            {proxySym && proxyQuotes?.[proxySym] && (() => {
              const q = proxyQuotes[proxySym]
              const c = q.pct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
              return (
                <div className="px-2 py-1.5 border-b border-terminal-border bg-terminal-accent/10 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-terminal-gold">
                      {displaySym(proxySym)} · proxy
                    </span>
                    <span className="text-xs font-bold text-terminal-text-bright">{fmt.price(q.last)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-2xs font-bold" style={{ color: c }}>
                      {q.pct >= 0 ? '+' : ''}{q.pct.toFixed(2)}%
                    </span>
                    {constQuotes && !constFetching && constituentStocks.length > 0 && (
                      <span className="text-2xs text-terminal-text-dim">
                        <span style={{ color:'var(--color-gain)' }}>▲{upCount}</span>
                        {' / '}
                        <span style={{ color:'var(--color-loss)' }}>▼{downCount}</span>
                        {' stocks'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Chart title */}
            <div className="px-2 py-1 border-b border-terminal-border/50 flex-shrink-0">
              <span className="text-2xs font-bold text-terminal-text-dim tracking-wide">
                {composite != null
                  ? `${secondaryMetric} ${selected.toUpperCase()} SECTOR TREND — ${composite.stockCount} STOCKS`
                  : `${secondaryMetric} PROXY: ${proxySym ? displaySym(proxySym) : '—'}`}
              </span>
            </div>

            {/* 30-day chart */}
            <div className="flex-shrink-0 border-b border-terminal-border" style={{ height: 118 }}>
              {useComposite && compositeFetching ? (
                <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim animate-pulse">
                  BUILDING SECTOR COMPOSITE...
                </div>
              ) : composite != null ? (() => {
                const last = composite.points[composite.points.length - 1]?.pct ?? 0
                const col = last >= 0 ? '#2d8a50' : '#a83232'
                return (
                  <ResponsiveContainer width="100%" height={118}>
                    <AreaChart data={composite.points} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="sectorCompositeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={col} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={col} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#0d2244" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 7 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 7 }} domain={['auto','auto']} width={36}
                        tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`} />
                      <Tooltip content={<CompositeTooltip />} />
                      <Area type="monotone" dataKey="pct" stroke={col} strokeWidth={1.5}
                        fill="url(#sectorCompositeGrad)" dot={false} isAnimationActive={false} connectNulls />
                      <Brush dataKey="date" height={16} stroke="rgba(201,168,76,0.3)" fill="#0B1628" tickFormatter={() => ''} />
                    </AreaChart>
                  </ResponsiveContainer>
                )
              })() : (
                <>
                  {histFetching && (
                    <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim animate-pulse">LOADING CHART...</div>
                  )}
                  {!histFetching && chartData.length < 2 && (
                    <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim/50">No chart data</div>
                  )}
                  {chartData.length >= 2 && (() => {
                    const col = proxyQuotes?.[proxySym]?.pct >= 0 ? '#2d8a50' : '#a83232'
                    return (
                      <ResponsiveContainer width="100%" height={118}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                          <defs>
                            <linearGradient id="sectorGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor={col} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={col} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#0d2244" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 7 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 7 }} domain={['auto','auto']} width={36} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey="price" stroke={col} strokeWidth={1.5}
                            fill="url(#sectorGrad)" dot={false} isAnimationActive={false} connectNulls />
                          <Brush dataKey="date" height={16} stroke="rgba(201,168,76,0.3)" fill="#0B1628" tickFormatter={() => ''} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )
                  })()}
                </>
              )}
            </div>

            {/* Composite methodology note, or explicit fallback notice */}
            {composite != null && (
              <div className="px-2 py-1 border-b border-terminal-border/50 flex-shrink-0">
                <span className="text-terminal-text-dim text-[8px]">
                  Equal-weighted composite of {constituentSyms.map(displaySym).join(' · ')}
                </span>
              </div>
            )}
            {compositeUnavailable && (
              <div className="px-2 py-1 border-b border-terminal-border/50 flex-shrink-0">
                <span className="text-terminal-red/70 text-[8px]">
                  Composite unavailable — showing {proxySym ? displaySym(proxySym) : 'proxy'} only
                </span>
              </div>
            )}

            {/* Constituents — ASX only */}
            {isASX && constituentStocks.length > 0 ? (
              <div className="flex-1 overflow-auto">
                <table className="terminal-table w-full">
                  <thead>
                    <tr>
                      <th className="px-2 text-left">STOCK</th>
                      <th className="px-1 text-right">PRICE</th>
                      <th className="px-1 text-right">CHG%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {constituentStocks.map(([sym, name]) => {
                      const q = constQuotes?.[sym]
                      const c = q ? (q.pct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)') : undefined
                      return (
                        <tr
                          key={sym}
                          className="cursor-pointer hover:bg-terminal-accent/20 transition-colors"
                          onClick={() => openModal?.({ symbol: sym, name, price: q?.last ?? 0, pct: q?.pct ?? 0, type:'asx', extra:{} })}
                        >
                          <td className="px-2 py-0.5">
                            <div className="text-xs font-bold text-terminal-text-bright">{displaySym(sym)}</div>
                            <div className="text-2xs text-terminal-text-dim truncate max-w-[110px]">{name}</div>
                          </td>
                          <td className="px-1 py-0.5 text-2xs text-right font-semibold">
                            {q ? fmt.price(q.last) : <span className="text-terminal-text-dim/50">—</span>}
                          </td>
                          <td className="px-1 py-0.5 text-2xs text-right font-semibold" style={{ color: c ?? 'var(--color-neutral)' }}>
                            {q ? `${q.pct >= 0 ? '+' : ''}${q.pct.toFixed(2)}%` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4 text-center">
                <span className="text-2xs text-terminal-text-dim/40 leading-relaxed">
                  No constituent data for this sector.
                </span>
              </div>
            )}

            <div className="border-t border-terminal-border p-1.5 text-2xs text-terminal-text-dim/60 flex-shrink-0 flex items-center justify-between">
              <span>{constituentStocks.length > 0 ? `${constituentStocks.length} holdings` : 'Proxy view'}</span>
              <span>{composite != null ? `${secondaryMetric} sector composite` : `${secondaryMetric} proxy: ${proxySym?.replace(/\.(AX|L)$/i,'') ?? '—'}`}{USING_MOCK_DATA ? ' · DEMO' : ''}</span>
            </div>
            </>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  )
}

// ─── Index View ───────────────────────────────────────────────────────────────

function IndexView({ selectedIndex, openModal }) {
  const { usdToAud, rates } = useAudRates()
  const [quotes, setQuotes]       = useState({})
  const [loadCount, setLoadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [sortCol, setSortCol]     = useState('rank')
  const [sortDir, setSortDir]     = useState('asc')
  const [search, setSearch]       = useState('')
  const loadRef = useRef(null)

  const constituents = INDEX_CONSTITUENTS[selectedIndex] ?? []
  const isASX = selectedIndex === '^AXJO' || selectedIndex === '^AORD'

  useEffect(() => {
    if (!selectedIndex || !constituents.length) return
    const indexKey = selectedIndex
    loadRef.current = indexKey

    const today = new Date().toISOString().slice(0, 10)
    const cacheKey = `madden_idx_${selectedIndex}_${today}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < 60_000) {
          setQuotes(data)
          setLoadCount(Object.keys(data).length)
          setIsLoading(false)
          return
        }
      }
    } catch {}

    setQuotes({})
    setLoadCount(0)
    setIsLoading(true)

    const run = async () => {
      const all = {}
      const batches = []
      for (let i = 0; i < constituents.length; i += 5) batches.push(constituents.slice(i, i + 5))

      for (const batch of batches) {
        if (loadRef.current !== indexKey) return
        try {
          const results = await fetchYahooBatch(batch)
          Object.assign(all, results)
          if (loadRef.current !== indexKey) return
          setQuotes(prev => ({ ...prev, ...results }))
          setLoadCount(Object.keys(all).length)
        } catch {}
        await new Promise(r => setTimeout(r, 400))
      }

      if (loadRef.current !== indexKey) return
      setIsLoading(false)
      try {
        const today2 = new Date().toISOString().slice(0, 10)
        localStorage.setItem(
          `madden_idx_${indexKey}_${today2}`,
          JSON.stringify({ data: all, ts: Date.now() })
        )
      } catch {}
    }
    run()
    return () => { loadRef.current = null }
  }, [selectedIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const [idxPeriod, setIdxPeriod] = useState('1mo')
  const { data: idxHistory, isFetching: idxHistLoading } = useQuery({
    queryKey: ['yfHistory', selectedIndex, idxPeriod],
    queryFn:  () => fetchYFHistory(selectedIndex, { range: idxPeriod }),
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const idxChartData = useMemo(() => {
    const raw = idxHistory ? transformYFHistory(idxHistory) : []
    return raw.filter(d => d && d.price != null && !isNaN(d.price))
  }, [idxHistory, selectedIndex])

  const rows = useMemo(() => {
    return constituents.map((sym, i) => {
      const q        = quotes[sym]
      const currency = q?.currency ?? (sym.endsWith('.AX') ? 'AUD' : 'USD')
      const convert  = (v) => nativeToAud(v, currency, rates) ?? (rates ? null : usdToAud(v))
      const audPrice  = convert(q?.last ?? null)
      const audChange = convert(q?.change ?? null)
      const aud52High = convert(q?.week52High ?? null)
      const aud52Low  = convert(q?.week52Low  ?? null)
      return {
        rank: i + 1, sym,
        ticker:    displaySym(sym),
        name:      STOCK_NAMES[sym] ?? displaySym(sym),
        currency,
        audPrice, audChange, aud52High, aud52Low,
        pct:    q?.pct    ?? null,
        weight: ASX_WEIGHTS[sym] ?? null,
        q,
      }
    })
  }, [constituents, quotes, rates, usdToAud])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    const base = s
      ? rows.filter(r => r.ticker.toLowerCase().includes(s) || r.name.toLowerCase().includes(s))
      : rows
    return [...base].sort((a, b) => {
      let va, vb
      if (sortCol === 'rank')        { va = a.rank;               vb = b.rank               }
      else if (sortCol === 'ticker') { va = a.ticker;             vb = b.ticker             }
      else if (sortCol === 'name')   { va = a.name;               vb = b.name               }
      else if (sortCol === 'price')  { va = a.audPrice  ?? -Infinity; vb = b.audPrice  ?? -Infinity }
      else if (sortCol === 'pct')    { va = a.pct       ?? -Infinity; vb = b.pct       ?? -Infinity }
      else if (sortCol === 'weight') { va = a.weight    ?? -Infinity; vb = b.weight    ?? -Infinity }
      else { va = a.rank; vb = b.rank }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [rows, search, sortCol, sortDir])

  const loaded  = rows.filter(r => r.q != null)
  const gainers = [...loaded].sort((a, b) => (b.pct ?? -99) - (a.pct ?? -99)).slice(0, 5)
  const losers  = [...loaded].sort((a, b) => (a.pct ?? 99)  - (b.pct ?? 99)).slice(0, 5)

  const toggleSort = useCallback((col) => {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return col }
      setSortDir('desc')
      return col
    })
  }, [])

  const handleRowClick = (r) => {
    if (!r.q) return
    const sym = isASX ? (r.ticker + '.AX') : r.ticker
    openModal?.({
      symbol: sym,
      name:   r.name,
      price:  r.audPrice ?? 0,
      pct:    r.pct ?? 0,
      change: r.audChange,
      type:   isASX ? 'asx' : 'us',
      extra:  {
        week52High:  r.aud52High,
        week52Low:   r.aud52Low,
        nativePrice: isASX ? null : r.q?.last,
        currency:    r.q?.currency,
      },
    })
  }

  const indexLabel = INDEX_LABELS[selectedIndex] ?? selectedIndex

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1 border-b border-terminal-border flex-shrink-0 bg-terminal-header">
        <span className="text-2xs text-terminal-text-dim">INDEX — {indexLabel}</span>
        {isLoading && (
          <span className="text-2xs text-terminal-text-dim animate-pulse">
            LOADING {loadCount}/{INDEX_EXPECTED_COUNT[selectedIndex] ?? constituents.length} STOCKS...
          </span>
        )}
        {!isLoading && loaded.length > 0 && (
          <span className="text-terminal-green text-2xs">● {loaded.length}/{INDEX_EXPECTED_COUNT[selectedIndex] ?? constituents.length} LOADED</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            placeholder="Search ticker or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-2xs px-2 py-0.5 bg-terminal-bg border border-terminal-border text-terminal-text placeholder:text-terminal-text-dim/40 outline-none focus:border-terminal-gold/50 w-40"
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full" style={{ borderCollapse:'collapse' }}>
            <thead className="sticky top-0 bg-terminal-header z-10">
              <tr className="text-2xs text-terminal-text-dim uppercase tracking-wider border-b border-terminal-border">
                {[
                  ['rank','#',         'w-8  text-center'],
                  ['ticker','TICKER',  'px-2 text-left'],
                  ['name','NAME',      'px-2 text-left hidden xl:table-cell'],
                  ['price','PRICE AUD','px-2 text-right'],
                  ['pct','CHG%',       'px-2 text-right'],
                  ['weight','WEIGHT',  'px-2 text-right hidden lg:table-cell'],
                ].map(([col, lbl, cls]) => (
                  <th key={col}
                    className={`py-1 cursor-pointer select-none hover:text-terminal-gold ${cls}`}
                    onClick={() => toggleSort(col)}>
                    {lbl}<SortIcon col={col} current={sortCol} dir={sortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const pctC = r.pct == null ? 'var(--color-neutral)' : r.pct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
                return (
                  <tr
                    key={r.sym}
                    className="border-b border-terminal-border/30 hover:bg-terminal-accent/20 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(r)}
                  >
                    <td className="py-1 text-2xs text-terminal-text-dim text-center w-8">{r.rank}</td>
                    <td className="py-1 px-2 text-xs font-bold text-terminal-text-bright">{r.ticker}</td>
                    <td className="py-1 px-2 text-2xs text-terminal-text-dim hidden xl:table-cell truncate max-w-[160px]">{r.name}</td>
                    <td className="py-1 px-2 text-2xs text-right font-semibold text-terminal-text-bright">
                      {r.audPrice != null ? fmt.price(r.audPrice) : (
                        <span className="inline-block w-16 h-2 bg-terminal-border/30 animate-pulse rounded" />
                      )}
                    </td>
                    <td className="py-1 px-2 text-2xs text-right font-semibold" style={{ color: pctC }}>
                      {r.pct != null ? `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(2)}%` : (
                        <span className="inline-block w-12 h-2 bg-terminal-border/30 animate-pulse rounded" />
                      )}
                    </td>
                    <td className="py-1 px-2 text-2xs text-right text-terminal-text-dim hidden lg:table-cell">
                      {r.weight != null ? `${r.weight}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {(() => {
            const meta = INDEX_METADATA[selectedIndex]
            if (!meta) return null
            const today = new Date().toISOString().slice(0, 10)
            const isPastRebalance = meta.nextRebalance < today
            return (
              <div style={{ padding: '6px 8px' }}>
                <div style={{ fontSize: '9px', color: 'var(--mt-muted)', textAlign: 'right' }}>
                  Composition as at {meta.lastUpdated} · Next rebalance ~{meta.nextRebalance} ·{' '}
                  <a href={meta.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--mt-gold)' }}>
                    Source: {meta.source}
                  </a>
                </div>
                {isPastRebalance && (
                  <div style={{ color: '#f59e0b', fontSize: '9px', marginTop: '4px', textAlign: 'right' }}>
                    ⚠ Composition may be outdated · Rebalance date has passed
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Sidebar */}
        <div className="w-48 border-l border-terminal-border flex flex-col overflow-hidden flex-shrink-0">
          <div className="border-b border-terminal-border flex-shrink-0 p-1">
            <div className="flex items-center justify-between mb-1">
              <div className="text-2xs text-terminal-text-dim">{indexLabel}</div>
              <div className="flex gap-0.5">
                {[['5d','5D'],['1mo','1M'],['3mo','3M']].map(([val, lbl]) => (
                  <button
                    key={val}
                    onClick={() => setIdxPeriod(val)}
                    className={`px-1 text-[8px] rounded transition-colors ${
                      idxPeriod === val ? 'bg-terminal-gold text-terminal-bg font-bold' : 'text-terminal-text-dim hover:text-terminal-gold'
                    }`}
                  >{lbl}</button>
                ))}
              </div>
            </div>
            <div style={{ height: 90 }}>
              {idxHistLoading && (
                <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim/50 animate-pulse">LOADING...</div>
              )}
              {!idxHistLoading && idxChartData.length >= 2 && (
                <ResponsiveContainer width="100%" height={90}>
                  <AreaChart data={idxChartData} margin={{ top: 2, right: 2, left: 0, bottom: 2 }}>
                    <defs>
                      <linearGradient id="idxGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#c8a84b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#c8a84b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={['auto','auto']} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="price" stroke="#c8a84b" strokeWidth={1.2}
                      fill="url(#idxGrad)" dot={false} isAnimationActive={false} connectNulls />
                    <Brush dataKey="date" height={14} stroke="rgba(201,168,76,0.3)" fill="#0B1628" tickFormatter={() => ''} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {!idxHistLoading && idxChartData.length < 2 && (
                <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim/40">No data</div>
              )}
            </div>
          </div>

          <div className="border-b border-terminal-border flex-shrink-0">
            <div className="px-2 py-1 text-2xs font-bold" style={{ color:'var(--color-gain)' }}>▲ TOP GAINERS</div>
            {gainers.map(r => (
              <div key={r.sym} className="flex items-center justify-between px-2 py-0.5 hover:bg-terminal-accent/20 cursor-pointer" onClick={() => handleRowClick(r)}>
                <span className="text-2xs font-bold text-terminal-text-bright">{r.ticker}</span>
                <span className="text-2xs font-semibold" style={{ color:'var(--color-gain)' }}>
                  {r.pct != null ? `+${r.pct.toFixed(2)}%` : '—'}
                </span>
              </div>
            ))}
            {gainers.length === 0 && (
              <div className="px-2 py-1 text-2xs text-terminal-text-dim/40">Loading...</div>
            )}
          </div>

          <div className="flex-shrink-0">
            <div className="px-2 py-1 text-2xs font-bold" style={{ color:'var(--color-loss)' }}>▼ TOP LOSERS</div>
            {losers.map(r => (
              <div key={r.sym} className="flex items-center justify-between px-2 py-0.5 hover:bg-terminal-accent/20 cursor-pointer" onClick={() => handleRowClick(r)}>
                <span className="text-2xs font-bold text-terminal-text-bright">{r.ticker}</span>
                <span className="text-2xs font-semibold" style={{ color:'var(--color-loss)' }}>
                  {r.pct != null ? `${r.pct.toFixed(2)}%` : '—'}
                </span>
              </div>
            ))}
            {losers.length === 0 && (
              <div className="px-2 py-1 text-2xs text-terminal-text-dim/40">Loading...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SectorHeatmap({ selectedIndex = '^AXJO', openModal }) {
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('madden_mkt_view') ?? 'sectors' } catch { return 'sectors' }
  })
  const [secondaryMetric, setSecondaryMetric] = useState('7D')

  // When radar clicks a sector, switch to sectors view so detail panel appears
  useEffect(() => {
    const handler = () => setView('sectors')
    window.addEventListener('madden:sector-select', handler)
    return () => window.removeEventListener('madden:sector-select', handler)
  }, [])

  const sectorConfig = useMemo(
    () => INDEX_SECTORS[selectedIndex] ?? INDEX_SECTORS['^AXJO'],
    [selectedIndex]
  )
  const proxySyms = useMemo(
    () => GICS_SECTORS.filter(s => sectorConfig[s]?.sym).map(s => sectorConfig[s].sym),
    [sectorConfig]
  )

  const { data: proxyQuotes, isFetching, isError, refetch } = useQuery({
    queryKey: ['yahooBatch', 'sectorProxy', selectedIndex],
    queryFn:  () => fetchYahooBatch(proxySyms),
    staleTime: 60_000,
    retry: 1,
    enabled:  proxySyms.length > 0,
  })

  // Fetch 1-year history for all proxy stocks (5D / 1M / YTD secondary metric)
  const histResults = useQueries({
    queries: proxySyms.map(sym => ({
      queryKey: ['yfHistory', sym, '1y'],
      queryFn:  () => fetchYFHistory(sym, { range: '1y' }),
      staleTime: 15 * 60_000,
      retry: 1,
    })),
  })

  const histData = useMemo(() => {
    const map = {}
    proxySyms.forEach((sym, i) => {
      const raw = histResults[i]?.data
      map[sym] = raw ? transformYFHistory(raw) : []
    })
    return map
  }, [histResults, proxySyms])

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-2 py-1.5 border-b border-terminal-border bg-terminal-header flex-shrink-0 flex-wrap gap-y-1">
        <span className="text-2xs font-bold text-terminal-gold tracking-widest">MARKETS</span>
        <ViewToggle view={view} setView={setView} />
        {view === 'sectors' && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-2xs text-terminal-text-dim/60">2ND METRIC:</span>
            <MetricToggle metric={secondaryMetric} setMetric={setSecondaryMetric} />
          </div>
        )}
      </div>

      <div className="panel-fade" key={view}>
        {view === 'sectors' ? (
          <SectorsView
            sectorConfig={sectorConfig}
            proxyQuotes={proxyQuotes}
            histData={histData}
            secondaryMetric={secondaryMetric}
            isFetching={isFetching}
            isError={isError}
            refetch={refetch}
            selectedIndex={selectedIndex}
            openModal={openModal}
          />
        ) : view === 'index' ? (
          <IndexView
            selectedIndex={selectedIndex}
            openModal={openModal}
          />
        ) : (
          <div style={{ height: 520 }}>
            <CorrelationMatrix />
          </div>
        )}
      </div>
    </div>
  )
}
