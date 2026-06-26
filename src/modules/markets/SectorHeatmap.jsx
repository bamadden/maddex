import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchYahooBatch, fetchYFHistory, transformYFHistory } from '../../services/api'
import { ASX_SECTOR_HEATMAP } from '../../data/placeholders'
import { fmt } from '../../utils/format'
import { useStore } from '../../store/useStore'
import { useAudRates } from '../../hooks/useAudRates'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ─── Sector proxy stocks (Stooq symbols) ─────────────────────────────────────

const SECTOR_PROXY = {
  XFJ: 'CBA.AX', XMJ: 'BHP.AX', XHJ: 'CSL.AX', XSJ: 'WOW.AX',
  XEJ: 'WDS.AX', XIJ: 'WES.AX', XPJ: 'GMG.AX', XIT: 'XRO.AX',
  XTJ: 'TLS.AX', XUJ: 'AGL.AX', XDJ: 'ALL.AX',
}
const PROXY_LABEL = {
  XFJ:'CBA', XMJ:'BHP', XHJ:'CSL', XSJ:'WOW', XEJ:'WDS',
  XIJ:'WES', XPJ:'GMG', XIT:'XRO', XTJ:'TLS', XUJ:'AGL', XDJ:'ALL',
}
const PROXY_SYMS = Object.values(SECTOR_PROXY)

const SECTOR_STOCKS = {
  XFJ: [['CBA.AX','Commonwealth Bank'],['ANZ.AX','ANZ'],['WBC.AX','Westpac'],['NAB.AX','NAB'],['MQG.AX','Macquarie'],['QBE.AX','QBE Insurance'],['IAG.AX','IAG'],['AMP.AX','AMP']],
  XMJ: [['BHP.AX','BHP'],['RIO.AX','Rio Tinto'],['FMG.AX','Fortescue'],['S32.AX','South32'],['MIN.AX','Mineral Resources'],['ILU.AX','Iluka'],['WHC.AX','Whitehaven'],['SFR.AX','Sandfire']],
  XHJ: [['CSL.AX','CSL'],['RHC.AX','Ramsay Health'],['SHL.AX','Sonic Healthcare'],['COH.AX','Cochlear'],['PME.AX','Pro Medicus'],['RMD.AX','ResMed'],['NHF.AX','nib Holdings'],['IDX.AX','Integral Diagnostics']],
  XIJ: [['BXB.AX','Brambles'],['WOR.AX','Worley'],['TCL.AX','Transurban'],['ALQ.AX','ALS'],['DOW.AX','Downer EDI'],['QAN.AX','Qantas'],['CIM.AX','CIMIC'],['SGF.AX','SG Fleet']],
  XSJ: [['WOW.AX','Woolworths'],['COL.AX','Coles'],['MTS.AX','Metcash'],['TWE.AX','Treasury Wine'],['GNC.AX','GrainCorp'],['ING.AX','Inghams'],['ALD.AX','Ampol'],['WHS.AX','Warehouse Group']],
  XIT: [['WTC.AX','WiseTech Global'],['XRO.AX','Xero'],['CPU.AX','Computershare'],['TYR.AX','Tyro Payments'],['NXT.AX','NextDC'],['ALU.AX','Altium'],['SEK.AX','Seek'],['CAR.AX','CAR Group']],
  XEJ: [['WDS.AX','Woodside Energy'],['STO.AX','Santos'],['BPT.AX','Beach Energy'],['KAR.AX','Karoon Energy'],['VEA.AX','Viva Energy'],['COE.AX','Cooper Energy'],['NHC.AX','New Hope Coal'],['WHC.AX','Whitehaven Coal']],
  XDJ: [['ALL.AX','Aristocrat'],['WEB.AX','Webjet'],['ARB.AX','ARB Corp'],['PMV.AX','Premier Investments'],['LOV.AX','Lovisa'],['SUL.AX','Super Retail'],['TRS.AX','The Reject Shop'],['GUD.AX','GUD Holdings']],
  XPJ: [['GMG.AX','Goodman Group'],['SCG.AX','Scentre Group'],['SCP.AX','SCA Property'],['VCX.AX','Vicinity Centres'],['DXS.AX','Dexus'],['MGR.AX','Mirvac'],['BWP.AX','BWP Trust'],['CLW.AX','Charter Hall']],
  XUJ: [['AGL.AX','AGL Energy'],['ORG.AX','Origin Energy'],['APA.AX','APA Group'],['AST.AX','AusNet Services'],['MCY.AX','Mercury NZ'],['MEZ.AX','Meridian Energy']],
  XTJ: [['TLS.AX','Telstra'],['REA.AX','REA Group'],['CAR.AX','CAR Group'],['SEK.AX','Seek'],['NXT.AX','NextDC'],['SXL.AX','Southern Cross Media']],
}

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
  ],
  '^GSPC': [
    'AAPL','NVDA','MSFT','AMZN','META','GOOG','GOOGL','TSLA','BRK-B','JPM',
    'UNH','V','XOM','MA','JNJ','PG','HD','AVGO','MRK','ABBV',
    'BAC','COST','CVX','NFLX','CRM','AMD','ADBE','TMO','ACN','WFC',
    'LIN','DHR','TXN','QCOM','MCD','ABT','PM','INTU','CAT','GS',
    'MS','BLK','SPGI','ISRG','RTX','AXP','SYK','LOW','VRTX','NOW',
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
  '^FTSE': ['SHEL','AZN','HSBC','ULVR','BP','RIO','GSK','BBL','DEO','LYG','BCS','VOD','BTI','NGG','PUK'],
  '^N225': ['TM','SNY','HMC','SONY','NTTYY','MFG','MUFG'],
}

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
  // NASDAQ 100
  'CSCO':'Cisco','AMGN':'Amgen','AMAT':'Applied Materials','MU':'Micron',
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
  // FTSE proxies (US-listed)
  'SHEL':'Shell','AZN':'AstraZeneca','HSBC':'HSBC','ULVR':'Unilever',
  'BP':'BP','RIO':'Rio Tinto ADR','GSK':'GSK','BBL':'BHP ADR',
  'DEO':'Diageo','LYG':'Lloyds','BCS':'Barclays','VOD':'Vodafone',
  'BTI':'BAT','NGG':'National Grid','PUK':'Prudential',
  // Nikkei proxies (US-listed ADRs)
  'TM':'Toyota','SNY':'Sony Corp','HMC':'Honda','SONY':'Sony',
  'NTTYY':'NTT','MFG':'Mizuho Financial','MUFG':'Mitsubishi UFJ',
}

const INDEX_LABELS = {
  '^AXJO':'ASX 200','^GSPC':'S&P 500','^IXIC':'NASDAQ 100',
  '^DJI':'Dow Jones 30','^FTSE':'FTSE 100','^N225':'Nikkei 225',
}

// Approximate weights for ASX 200 top 20
const ASX_WEIGHTS = {
  'BHP.AX':10.2,'CBA.AX':8.9,'CSL.AX':5.1,'ANZ.AX':3.2,'NAB.AX':3.8,
  'WBC.AX':3.1,'WES.AX':3.5,'MQG.AX':3.2,'WOW.AX':2.1,'RIO.AX':2.9,
  'GMG.AX':2.6,'FMG.AX':1.8,'TLS.AX':1.7,'REA.AX':1.5,'ALL.AX':1.4,
  'MIN.AX':0.8,'STO.AX':0.9,'WDS.AX':1.2,'AGL.AX':0.5,'NEM.AX':0.9,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctToBg(pct) {
  if (pct == null) return { bg: 'rgba(26,58,107,0.20)', text: 'var(--color-neutral)' }
  if (pct >=  2)   return { bg: 'rgba(46,160,90,0.45)',  text: 'var(--color-gain)' }
  if (pct >=  0.5) return { bg: 'rgba(46,160,90,0.25)',  text: 'var(--color-gain)' }
  if (pct >= -0.5) return { bg: 'rgba(201,168,76,0.20)', text: 'var(--color-neutral)' }
  if (pct >= -2)   return { bg: 'rgba(180,60,60,0.25)',  text: 'var(--color-loss)' }
  return               { bg: 'rgba(180,60,60,0.45)',  text: 'var(--color-loss)' }
}

function displaySym(yahoo) {
  return yahoo.replace(/\.AX$/i, '').toUpperCase()
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

// ─── Toggle button ────────────────────────────────────────────────────────────

function ViewToggle({ view, setView }) {
  return (
    <div className="flex gap-0 border border-terminal-gold/30">
      {[['sectors','SECTORS VIEW'],['index','INDEX VIEW']].map(([v, label]) => (
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

// ─── Sectors View ─────────────────────────────────────────────────────────────

function SectorsView({ proxyQuotes, isFetching, isError, refetch, selectedIndex, openModal }) {
  const [selected, setSelected] = useState(null)

  const constituentSyms = selected ? (SECTOR_STOCKS[selected] ?? []).map(([s]) => s) : []
  const { data: constQuotes, isFetching: constFetching } = useQuery({
    queryKey: ['yahooBatch', 'sectorConst', selected],
    queryFn:  () => fetchYahooBatch(constituentSyms),
    enabled:  constituentSyms.length > 0,
    staleTime: 60_000,
    retry: 1,
  })

  const proxySym = selected ? SECTOR_PROXY[selected] : null
  const { data: rawHistory, isFetching: histFetching } = useQuery({
    queryKey: ['yfHistory', proxySym, '1mo'],
    queryFn:  () => fetchYFHistory(proxySym, { range: '1mo' }),
    enabled:  !!proxySym,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const chartData = useMemo(() => {
    const raw = rawHistory ? transformYFHistory(rawHistory) : []
    const safe = raw.filter(d => d && d.price != null && !isNaN(d.price))
    console.log(`[Chart] sector-${proxySym} — ${safe.length} data points`)
    return safe
  }, [rawHistory, proxySym])

  const constArr = constQuotes ? Object.values(constQuotes) : []
  const upCount   = constArr.filter(q => q.pct > 0).length
  const downCount = constArr.filter(q => q.pct < 0).length
  const selectedSector = selected ? ASX_SECTOR_HEATMAP.find(s => s.ticker === selected) : null
  const isLive = !!proxyQuotes && !isError
  const updatedTime = new Date().toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit' })
  const indexLabel = INDEX_LABELS[selectedIndex] ?? 'ASX 200'

  const askAISector = () => {
    if (!selectedSector) return
    const q = proxyQuotes?.[proxySym]
    const pctStr = q ? `${q.pct >= 0 ? '+' : ''}${q.pct.toFixed(2)}%` : 'N/A'
    const proxy = PROXY_LABEL[selected] ?? selected
    const prompt = `Analyse the ASX ${selectedSector.name} sector (${selected}) performance today. Proxy stock ${proxy}: ${pctStr}. Up: ${upCount} stocks, Down: ${downCount} stocks. Sector weight: ${selectedSector.mktCapWeight}% of ASX 200. Key drivers and outlook for AUD investors.`
    window.dispatchEvent(new CustomEvent('madden:ask-ai', { detail: { prompt } }))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-terminal-border flex-shrink-0 bg-terminal-header">
        <span className="text-2xs text-terminal-text-dim">SECTORS — {indexLabel}</span>
        {isFetching && <span className="text-2xs text-terminal-text-dim animate-pulse">LOADING...</span>}
        {isLive && <span className="text-terminal-green text-2xs">● LIVE {updatedTime}</span>}
        {isError && !isFetching && (
          <button onClick={refetch} className="text-2xs text-terminal-red hover:text-terminal-gold">⚠ RETRY</button>
        )}
        {selected && (
          <button onClick={() => setSelected(null)} className="ml-auto text-2xs text-terminal-text-dim hover:text-terminal-gold">
            CLOSE ✕
          </button>
        )}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Heatmap grid */}
        <div className={`overflow-auto p-2 transition-all duration-150 ${selected ? 'w-[55%]' : 'w-full'}`}>
          <div className={`grid gap-1.5 ${selected ? 'grid-cols-2 xl:grid-cols-3' : 'grid-cols-3 xl:grid-cols-4'}`}>
            {ASX_SECTOR_HEATMAP.map((sector) => {
              const proxyKey   = SECTOR_PROXY[sector.ticker]
              const q          = proxyQuotes?.[proxyKey]
              const pct        = q?.pct ?? null
              const { bg, text } = pctToBg(pct)
              const isSelected = selected === sector.ticker
              const arrow = pct == null ? '' : pct >= 0 ? '▲' : '▼'

              return (
                <div
                  key={sector.ticker}
                  className="p-2 cursor-pointer select-none transition-all duration-150"
                  style={{
                    backgroundColor: bg,
                    border: isSelected ? '2px solid #c8a84b' : '1px solid rgba(255,255,255,0.06)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.25)' }}
                  onMouseLeave={e => { e.currentTarget.style.filter = '' }}
                  onClick={() => setSelected(isSelected ? null : sector.ticker)}
                >
                  <div className="text-2xs font-bold text-terminal-text-bright truncate leading-tight">{sector.name}</div>
                  <div className="text-sm font-bold mt-0.5 leading-tight" style={{ color: text }}>
                    {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : `${sector.mktCapWeight}%`}
                  </div>
                  <div className="text-2xs mt-0.5" style={{ color: text, opacity: 0.8 }}>
                    {pct != null
                      ? `${arrow} ${Math.abs(pct).toFixed(2)}% today`
                      : <span className="text-terminal-text-dim/70">{sector.ticker} · {sector.mktCapWeight}% ASX</span>
                    }
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-2 text-2xs text-terminal-text-dim/50 text-center">
            {isLive ? `Proxy stock prices · Yahoo Finance · ${updatedTime} AEST` : 'ASX 200 GICS sector weights · Click to drill down'}
          </div>
        </div>

        {/* Detail panel */}
        {selected && selectedSector && (
          <div className="w-[45%] border-l border-terminal-border flex flex-col overflow-hidden panel-fade">
            <div className="panel-header flex items-center gap-2 flex-shrink-0">
              <span className="text-terminal-gold truncate">{selectedSector.name.toUpperCase()}</span>
              {constFetching && <span className="text-2xs text-terminal-text-dim font-normal animate-pulse">LOADING...</span>}
              {constQuotes && !constFetching && <span className="text-terminal-green text-2xs font-normal">● LIVE</span>}
              <button onClick={askAISector}
                className="ml-auto text-2xs border border-terminal-gold/40 text-terminal-gold/70 hover:border-terminal-gold hover:text-terminal-gold px-1.5 py-0.5 transition-colors">
                AI ▶
              </button>
            </div>

            {/* Proxy summary */}
            {proxyQuotes?.[proxySym] && (() => {
              const q = proxyQuotes[proxySym]
              const c = q.pct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)'
              return (
                <div className="px-2 py-1.5 border-b border-terminal-border bg-terminal-accent/10 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-terminal-gold">{PROXY_LABEL[selected]} proxy · {selectedSector.mktCapWeight}% ASX 200</span>
                    <span className="text-xs font-bold text-terminal-text-bright">{fmt.price(q.last)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-2xs font-bold" style={{ color: c }}>
                      {q.pct >= 0 ? '+' : ''}{q.pct.toFixed(2)}%
                    </span>
                    {constQuotes && !constFetching && (
                      <span className="text-2xs text-terminal-text-dim">
                        <span style={{ color:'var(--color-gain)' }}>▲{upCount}</span>{' / '}
                        <span style={{ color:'var(--color-loss)' }}>▼{downCount}</span>{' stocks'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* 30-day chart */}
            <div className="flex-shrink-0 border-b border-terminal-border" style={{ height: 100 }}>
              {histFetching && (
                <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim animate-pulse">LOADING CHART...</div>
              )}
              {!histFetching && chartData.length < 2 && (
                <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim/50">No chart data</div>
              )}
              {chartData.length >= 2 && (() => {
                const col = proxyQuotes?.[proxySym]?.pct >= 0 ? '#2d8a50' : '#a83232'
                return (
                  <ResponsiveContainer width="100%" height={100}>
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
                    </AreaChart>
                  </ResponsiveContainer>
                )
              })()}
            </div>

            {/* Constituents */}
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
                  {(SECTOR_STOCKS[selected] ?? []).map(([sym, name]) => {
                    const q = constQuotes?.[sym]
                    const c = q ? (q.pct >= 0 ? 'var(--color-gain)' : 'var(--color-loss)') : undefined
                    return (
                      <tr key={sym}
                        className="cursor-pointer hover:bg-terminal-accent/20 transition-colors"
                        onClick={() => openModal?.({ symbol: sym.replace('.AX','') + '.AX', name, price: q?.last ?? 0, pct: q?.pct ?? 0, type:'asx', extra:{} })}
                      >
                        <td className="px-2 py-0.5">
                          <div className="text-xs font-bold text-terminal-text-bright">{sym.replace('.AX','')}</div>
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
            <div className="border-t border-terminal-border p-1.5 text-2xs text-terminal-text-dim/60 flex-shrink-0 flex items-center justify-between">
              <span>{(SECTOR_STOCKS[selected] ?? []).length} holdings</span>
              <span>30D {PROXY_LABEL[selected] ?? selected} · Yahoo</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Index View ───────────────────────────────────────────────────────────────

function IndexView({ selectedIndex, openModal }) {
  const { usdToAud } = useAudRates()
  const [quotes, setQuotes]     = useState({})
  const [loadCount, setLoadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [sortCol, setSortCol]   = useState('rank')
  const [sortDir, setSortDir]   = useState('asc')
  const [search, setSearch]     = useState('')
  const loadRef = useRef(null)

  const constituents = INDEX_CONSTITUENTS[selectedIndex] ?? []
  const isASX = selectedIndex === '^AXJO'

  // Fetch constituents in batches with localStorage cache
  useEffect(() => {
    if (!selectedIndex || !constituents.length) return
    const indexKey = selectedIndex
    loadRef.current = indexKey

    // Check localStorage cache (60s TTL — live stock prices, never serve stale)
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

  // 30-day index chart
  const { data: idxHistory, isFetching: idxHistLoading } = useQuery({
    queryKey: ['yfHistory', selectedIndex, '1mo'],
    queryFn:  () => fetchYFHistory(selectedIndex, { range: '1mo' }),
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const idxChartData = useMemo(() => {
    const raw = idxHistory ? transformYFHistory(idxHistory) : []
    const safe = raw.filter(d => d && d.price != null && !isNaN(d.price))
    console.log(`[Chart] index-${selectedIndex} — ${safe.length} data points`)
    return safe
  }, [idxHistory, selectedIndex])

  // Sort + filter + compute AUD prices
  const rows = useMemo(() => {
    return constituents.map((sym, i) => {
      const q = quotes[sym]
      const isAud = sym.endsWith('.AX')
      const rawPrice = q?.last ?? null
      const audPrice  = rawPrice == null ? null : isAud ? rawPrice : usdToAud(rawPrice)
      const audChange = q?.change == null ? null : isAud ? q.change : usdToAud(q.change)
      const aud52High = q?.week52High == null ? null : isAud ? q.week52High : usdToAud(q.week52High)
      const aud52Low  = q?.week52Low  == null ? null : isAud ? q.week52Low  : usdToAud(q.week52Low)
      return {
        rank: i + 1,
        sym,
        ticker: displaySym(sym),
        name: STOCK_NAMES[sym] ?? displaySym(sym),
        audPrice,
        audChange,
        aud52High,
        aud52Low,
        pct: q?.pct ?? null,
        weight: ASX_WEIGHTS[sym] ?? null,
        q,
      }
    })
  }, [constituents, quotes, usdToAud])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    const base = s
      ? rows.filter(r => r.ticker.toLowerCase().includes(s) || r.name.toLowerCase().includes(s))
      : rows

    return [...base].sort((a, b) => {
      let va, vb
      if (sortCol === 'rank')   { va = a.rank;    vb = b.rank    }
      else if (sortCol === 'ticker') { va = a.ticker; vb = b.ticker  }
      else if (sortCol === 'name')   { va = a.name;   vb = b.name    }
      else if (sortCol === 'price')  { va = a.audPrice ?? -Infinity; vb = b.audPrice ?? -Infinity }
      else if (sortCol === 'pct')    { va = a.pct ?? -Infinity;     vb = b.pct ?? -Infinity      }
      else if (sortCol === 'weight') { va = a.weight ?? -Infinity;  vb = b.weight ?? -Infinity   }
      else { va = a.rank; vb = b.rank }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [rows, search, sortCol, sortDir])

  const loaded = rows.filter(r => r.q != null)
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
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-terminal-border flex-shrink-0 bg-terminal-header">
        <span className="text-2xs text-terminal-text-dim">INDEX — {indexLabel}</span>
        {isLoading && (
          <span className="text-2xs text-terminal-text-dim animate-pulse">
            LOADING {loadCount}/{constituents.length} STOCKS...
          </span>
        )}
        {!isLoading && loaded.length > 0 && (
          <span className="text-terminal-green text-2xs">● {loaded.length}/{constituents.length} LOADED</span>
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
        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full" style={{ borderCollapse:'collapse' }}>
            <thead className="sticky top-0 bg-terminal-header z-10">
              <tr className="text-2xs text-terminal-text-dim uppercase tracking-wider border-b border-terminal-border">
                {[
                  ['rank','#',  'w-8  text-center'],
                  ['ticker','TICKER', 'px-2 text-left'],
                  ['name','NAME', 'px-2 text-left hidden xl:table-cell'],
                  ['price','PRICE AUD', 'px-2 text-right'],
                  ['pct','CHG%', 'px-2 text-right'],
                  ['weight','WEIGHT', 'px-2 text-right hidden lg:table-cell'],
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
        </div>

        {/* Sidebar */}
        <div className="w-48 border-l border-terminal-border flex flex-col overflow-hidden flex-shrink-0">
          {/* 30-day index chart */}
          <div className="border-b border-terminal-border flex-shrink-0 p-1">
            <div className="text-2xs text-terminal-text-dim mb-1">{indexLabel} 30D</div>
            <div style={{ height: 80 }}>
              {idxHistLoading && (
                <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim/50 animate-pulse">LOADING...</div>
              )}
              {!idxHistLoading && idxChartData.length >= 2 && (
                <ResponsiveContainer width="100%" height={80}>
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
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {!idxHistLoading && idxChartData.length < 2 && (
                <div className="flex items-center justify-center h-full text-2xs text-terminal-text-dim/40">No data</div>
              )}
            </div>
          </div>

          {/* Gainers */}
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

          {/* Losers */}
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

  const { data: proxyQuotes, isFetching, isError, refetch } = useQuery({
    queryKey: ['yahooBatch', 'sectorProxy'],
    queryFn:  () => fetchYahooBatch(PROXY_SYMS),
    staleTime: 60_000,
    retry: 1,
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with toggle */}
      <div className="flex items-center gap-3 px-2 py-1.5 border-b border-terminal-border bg-terminal-header flex-shrink-0">
        <span className="text-2xs font-bold text-terminal-gold tracking-widest">MARKETS</span>
        <ViewToggle view={view} setView={setView} />
      </div>

      {/* View content */}
      <div className="flex-1 min-h-0 overflow-hidden panel-fade" key={view}>
        {view === 'sectors' ? (
          <SectorsView
            proxyQuotes={proxyQuotes}
            isFetching={isFetching}
            isError={isError}
            refetch={refetch}
            selectedIndex={selectedIndex}
            openModal={openModal}
          />
        ) : (
          <IndexView
            selectedIndex={selectedIndex}
            openModal={openModal}
          />
        )}
      </div>
    </div>
  )
}
