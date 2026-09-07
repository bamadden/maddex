import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ReferenceLine } from 'recharts'
import SafeChart from '../../components/ui/SafeChart'
import ModuleHeader from '../../components/ui/ModuleHeader'
import Tooltip from '../../components/ui/Tooltip'
import TabBar from '../../components/ui/TabBar'
import {
  TAX_YEAR, TAX_BRACKETS, TAX_SOURCE, SUPER, ASFA, STAMP_DUTY,
  fullTaxPosition, stampDuty, marginalRate,
} from '../../data/auTaxRates'
import { compound, drp, loanPayment, amortise, superProjection, cgt } from './calcMath'

// ─── Financial calculators ──────────────────────────────────────────────────
//
// Eleven calculators. Every output is arithmetic on the inputs — nothing here
// is generated, estimated or fetched, which is why each one can be checked by
// hand and several were.
//
// Rates come from auTaxRates.js with their source and year attached. The one
// place a calculator declines to produce a number is stamp duty outside
// Queensland, and that file explains why.

const money = (v, dp = 0) =>
  v == null || !Number.isFinite(v) ? '—'
    : `A$${v.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`

const TABS = [
  { key: 'investment', label: 'INVESTMENT' },
  { key: 'super',      label: 'SUPER' },
  { key: 'property',   label: 'PROPERTY' },
  { key: 'tax',        label: 'TAX' },
  { key: 'loans',      label: 'LOANS' },
]

// ─── Shared shells ──────────────────────────────────────────────────────────

function Field({ label, value, onChange, suffix, type = 'number', options, step }) {
  return (
    <label className="block mb-2.5">
      <span className="font-mono text-terminal-gold/70" style={{ fontSize: 8, letterSpacing: '0.14em' }}>{label}</span>
      <div className="flex items-center gap-1.5 mt-1">
        {options ? (
          <select
            value={value} onChange={(e) => onChange(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border px-2 py-1.5 text-terminal-text-bright outline-none focus:border-terminal-gold"
            style={{ fontSize: 13 }}
          >
            {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
          </select>
        ) : (
          <input
            type={type} value={value} step={step}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border px-2 py-1.5 text-terminal-text-bright outline-none focus:border-terminal-gold tabular-nums"
            style={{ fontSize: 13 }}
          />
        )}
        {suffix && <span className="font-mono text-terminal-text-dim/50 flex-shrink-0" style={{ fontSize: 10 }}>{suffix}</span>}
      </div>
    </label>
  )
}

function Calc({ title, note, inputs, children }) {
  return (
    <div className="border border-terminal-border mb-4">
      <div className="panel-header flex items-center gap-2">
        <span>{title}</span>
        {note && <span className="text-2xs font-normal normal-case text-terminal-text-dim/50">{note}</span>}
      </div>
      <div className="flex flex-col lg:flex-row">
        <div className="p-3 border-b lg:border-b-0 lg:border-r border-terminal-border flex-shrink-0" style={{ width: 'min(100%, 360px)' }}>
          {inputs}
        </div>
        <div className="p-3 flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}

function Headline({ label, value, tone = '#C9A84C' }) {
  return (
    <div className="mb-3">
      <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8, letterSpacing: '0.14em' }}>{label}</div>
      <div className="font-mono font-bold tabular-nums leading-none" style={{ fontSize: 28, color: tone, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function Metric({ label, value, tone, tip }) {
  const body = (
    <div>
      <div className="font-mono text-terminal-text-dim/50" style={{ fontSize: 8, letterSpacing: '0.12em' }}>{label}</div>
      <div className="font-mono font-bold tabular-nums" style={{ fontSize: 13, color: tone ?? '#E6EDF6' }}>{value}</div>
    </div>
  )
  return tip ? <Tooltip content={tip}>{body}</Tooltip> : body
}

const num = (v, fallback = 0) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

// ─── INVESTMENT ─────────────────────────────────────────────────────────────

function CompoundCalc() {
  const [initial, setInitial] = useState('10000')
  const [contribution, setContribution] = useState('500')
  const [freq, setFreq] = useState('12')
  const [rate, setRate] = useState('8')
  const [years, setYears] = useState('20')
  const [compounds, setCompounds] = useState('12')

  const r = useMemo(() => compound({
    initial: num(initial), contribution: num(contribution),
    contributionsPerYear: num(freq, 12), annualRate: num(rate),
    years: num(years), compoundsPerYear: num(compounds, 12),
  }), [initial, contribution, freq, rate, years, compounds])

  return (
    <Calc
      title="COMPOUND GROWTH"
      note="updates as you type"
      inputs={
        <>
          <Field label="INITIAL INVESTMENT" value={initial} onChange={setInitial} suffix="A$" />
          <Field label="REGULAR CONTRIBUTION" value={contribution} onChange={setContribution} suffix="A$" />
          <Field label="CONTRIBUTION FREQUENCY" value={freq} onChange={setFreq}
            options={[{ value: '12', label: 'Monthly' }, { value: '26', label: 'Fortnightly' }, { value: '4', label: 'Quarterly' }, { value: '1', label: 'Annually' }]} />
          <Field label="ANNUAL RETURN" value={rate} onChange={setRate} suffix="%" step="0.1" />
          <Field label="TIME PERIOD" value={years} onChange={setYears} suffix="yr" />
          <Field label="COMPOUNDING" value={compounds} onChange={setCompounds}
            options={[{ value: '12', label: 'Monthly' }, { value: '4', label: 'Quarterly' }, { value: '1', label: 'Annually' }]} />
        </>
      }
    >
      <Headline label="FINAL VALUE" value={money(r.final)} />
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Metric label="TOTAL CONTRIBUTIONS" value={money(r.contributed)} tone="#8BA3C4" />
        <Metric label="TOTAL RETURNS" value={money(r.returns)} tone="#2D8A50" />
        <Metric label="RETURN ON CONTRIBUTIONS" value={`${r.roi.toFixed(1)}%`} tone={r.roi >= 0 ? '#2D8A50' : '#CC4444'} />
      </div>
      <div style={{ height: 180 }}>
        <SafeChart width="100%" height="100%">
          <AreaChart data={r.series} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#0F1E35" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 8 }} />
            <YAxis tick={{ fontSize: 8 }} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <RTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload
                return (
                  <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs space-y-0.5">
                    <div className="text-terminal-text-dim">Year {label}</div>
                    <div><span className="text-terminal-blue-bright">Contributed: </span>{money(p.contributed)}</div>
                    <div><span className="text-terminal-gold">Returns: </span>{money(p.returns)}</div>
                    <div className="text-terminal-text-bright font-bold">{money(p.value)}</div>
                  </div>
                )
              }}
            />
            <Area type="monotone" dataKey="contributed" stackId="1" stroke="#4A7FB5" fill="#4A7FB5" fillOpacity={0.35} isAnimationActive={false} />
            <Area type="monotone" dataKey="returns" stackId="1" stroke="#C9A84C" fill="#C9A84C" fillOpacity={0.35} isAnimationActive={false} />
          </AreaChart>
        </SafeChart>
      </div>
      <div className="text-terminal-text-dim/50 leading-snug mt-2" style={{ fontSize: 8 }}>
        Contributions are treated as arriving at the END of each period, the conservative convention.
        Assuming they arrive at the start raises the total by roughly one period&apos;s growth.
      </div>
    </Calc>
  )
}

function DrpCalc() {
  const [shares, setShares] = useState('1000')
  const [price, setPrice] = useState('43.21')
  const [yieldPct, setYieldPct] = useState('4.2')
  const [participation, setParticipation] = useState('100')
  const [years, setYears] = useState('10')

  const r = useMemo(() => drp({
    shares: num(shares), price: num(price), yieldPct: num(yieldPct),
    participation: num(participation), years: num(years),
  }), [shares, price, yieldPct, participation, years])

  return (
    <Calc
      title="DIVIDEND REINVESTMENT (DRP)"
      inputs={
        <>
          <Field label="SHARES OWNED" value={shares} onChange={setShares} />
          <Field label="SHARE PRICE" value={price} onChange={setPrice} suffix="A$" step="0.01" />
          <Field label="ANNUAL DIVIDEND YIELD" value={yieldPct} onChange={setYieldPct} suffix="%" step="0.1" />
          <Field label="DRP PARTICIPATION" value={participation} onChange={setParticipation} suffix="%" />
          <Field label="YEARS" value={years} onChange={setYears} suffix="yr" />
        </>
      }
    >
      <Headline label="PORTFOLIO VALUE WITH DRP" value={money(r.drpValue)} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="FINAL SHARES" value={Math.round(r.finalShares).toLocaleString()} />
        <Metric label="IF TAKEN AS CASH" value={money(r.cashValue)} tone="#8BA3C4"
          tip="Shares held flat, with every dividend taken as cash and simply accumulated — not reinvested elsewhere." />
        <Metric label="DRP ADVANTAGE" value={money(r.advantage)} tone={r.advantage >= 0 ? '#2D8A50' : '#CC4444'} />
        <Metric label="CASH TAKEN" value={money(r.cashTaken)} tone="#8BA3C4" />
      </div>
      <div className="text-terminal-text-dim/50 leading-snug mt-3" style={{ fontSize: 8 }}>
        Assumes a flat share price and a constant yield — no capital growth is assumed, so the advantage shown
        is the compounding of the shares alone. Dividends are taxable in the year received whether or not they
        are reinvested; tax is not modelled here.
      </div>
    </Calc>
  )
}

function BrokerageCalc() {
  const [shares, setShares] = useState('1000')
  const [price, setPrice] = useState('43.21')
  const [brokerage, setBrokerage] = useState('9.50')

  const r = useMemo(() => {
    const s = num(shares), p = num(price), b = num(brokerage)
    const gross = s * p
    const total = gross + b
    // Break-even has to cover brokerage BOTH ways — buying and selling — which
    // is the part most people leave out and the reason small parcels hurt.
    const breakEven = s > 0 ? (total + b) / s : 0
    return { gross, total, effective: s > 0 ? total / s : 0, breakEven, pct: gross > 0 ? (b / gross) * 100 : 0 }
  }, [shares, price, brokerage])

  return (
    <Calc
      title="TRUE COST OF A TRADE"
      inputs={
        <>
          <Field label="SHARES" value={shares} onChange={setShares} />
          <Field label="PRICE PER SHARE" value={price} onChange={setPrice} suffix="A$" step="0.01" />
          <Field label="BROKERAGE" value={brokerage} onChange={setBrokerage} suffix="A$" step="0.01" />
        </>
      }
    >
      <Headline label="TOTAL COST" value={money(r.total, 2)} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="SHARES VALUE" value={money(r.gross, 2)} tone="#8BA3C4" />
        <Metric label="EFFECTIVE PRICE" value={money(r.effective, 4)} tip="Total outlay divided by shares — what you actually paid per share." />
        <Metric label="BREAK-EVEN SELL" value={money(r.breakEven, 4)}
          tip="Covers brokerage on BOTH the buy and the sell. A break-even that only counts the buy leaves you short by one more brokerage charge." />
        <Metric label="BROKERAGE % OF TRADE" value={`${r.pct.toFixed(3)}%`} tone={r.pct > 0.5 ? '#CC4444' : r.pct > 0.15 ? '#C9A84C' : '#2D8A50'} />
      </div>
    </Calc>
  )
}

// ─── SUPER ──────────────────────────────────────────────────────────────────

function SuperCalc() {
  const [age, setAge] = useState('30')
  const [retireAge, setRetireAge] = useState('67')
  const [balance, setBalance] = useState('85000')
  const [salary, setSalary] = useState('95000')
  const [sg, setSg] = useState(String(SUPER.sgRate * 100))
  const [extra, setExtra] = useState('0')
  const [ret, setRet] = useState('7')
  const [boostWeekly, setBoostWeekly] = useState('50')

  const base = useMemo(() => superProjection({
    age: num(age), retireAge: num(retireAge), balance: num(balance), salary: num(salary),
    sgRate: num(sg) / 100, extraAnnual: num(extra), returnPct: num(ret),
  }), [age, retireAge, balance, salary, sg, extra, ret])

  const boosted = useMemo(() => superProjection({
    age: num(age), retireAge: num(retireAge), balance: num(balance), salary: num(salary),
    sgRate: num(sg) / 100, extraAnnual: num(extra) + num(boostWeekly) * 52, returnPct: num(ret),
  }), [age, retireAge, balance, salary, sg, extra, ret, boostWeekly])

  const drawdown = base.final * 0.04
  const marginal = marginalRate(num(salary)) * 100
  const boostAnnual = num(boostWeekly) * 52
  const taxSaving = boostAnnual * ((marginal / 100) - SUPER.contributionsTax)

  return (
    <Calc
      title="SUPER PROJECTOR"
      note={`SG ${SUPER.sgRate * 100}% · ${TAX_YEAR}`}
      inputs={
        <>
          <Field label="CURRENT AGE" value={age} onChange={setAge} />
          <Field label="RETIREMENT AGE" value={retireAge} onChange={setRetireAge} />
          <Field label="CURRENT BALANCE" value={balance} onChange={setBalance} suffix="A$" />
          <Field label="ANNUAL SALARY" value={salary} onChange={setSalary} suffix="A$" />
          <Field label="EMPLOYER SG RATE" value={sg} onChange={setSg} suffix="%" step="0.5" />
          <Field label="EXTRA CONTRIBUTION" value={extra} onChange={setExtra} suffix="A$/yr" />
          <Field label="ASSUMED RETURN" value={ret} onChange={setRet} suffix="%" step="0.5" />
        </>
      }
    >
      <Headline label={`PROJECTED BALANCE AT ${num(retireAge)}`} value={money(base.final)} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <Metric label="MONTHLY INCOME (4% DRAWDOWN)" value={money(drawdown / 12)}
          tip="The 4% rule is a rule of thumb, not a guarantee — it comes from US historical data and assumes a balanced portfolio." />
        <Metric label="YEARS TO RETIREMENT" value={`${base.years}`} />
        <Metric label="NET CONTRIBUTIONS" value={money(base.totalContrib)} tone="#8BA3C4"
          tip="After the 15% contributions tax. Gross contributions are higher." />
      </div>

      <div style={{ height: 150 }}>
        <SafeChart width="100%" height="100%">
          <AreaChart data={base.series} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#0F1E35" vertical={false} />
            <XAxis dataKey="age" tick={{ fontSize: 8 }} />
            <YAxis tick={{ fontSize: 8 }} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <RTooltip content={({ active, payload, label }) => (!active || !payload?.length) ? null : (
              <div className="bg-terminal-panel border border-terminal-border px-2 py-1 text-2xs">
                <div className="text-terminal-text-dim">Age {label}</div>
                <div className="text-terminal-gold font-bold">{money(payload[0].value)}</div>
              </div>
            )} />
            {[40, 50, 60].filter((m) => m > num(age) && m < num(retireAge)).map((m) => (
              <ReferenceLine key={m} x={m} stroke="rgba(201,168,76,0.25)" strokeDasharray="3 3" />
            ))}
            <Area type="monotone" dataKey="value" stroke="#C9A84C" fill="#C9A84C" fillOpacity={0.18} isAnimationActive={false} />
          </AreaChart>
        </SafeChart>
      </div>

      <div className="border-t border-terminal-border/40 mt-3 pt-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div style={{ width: 160 }}>
            <Field label="ADD EXTRA PER WEEK" value={boostWeekly} onChange={setBoostWeekly} suffix="A$" />
          </div>
          <div className="flex-1 min-w-0">
            <Metric label="EXTRA AT RETIREMENT" value={money(boosted.final - base.final)} tone="#2D8A50" />
          </div>
          <div className="flex-1 min-w-0">
            <Metric label="EXTRA MONTHLY INCOME" value={money(((boosted.final - base.final) * 0.04) / 12)} tone="#2D8A50" />
          </div>
        </div>
        {taxSaving > 0 && (
          <div className="mt-2 px-2 py-1.5" style={{ background: 'rgba(45,138,80,0.1)', border: '1px solid rgba(45,138,80,0.3)' }}>
            <span className="font-mono text-terminal-green" style={{ fontSize: 10 }}>
              Concessional contributions are taxed at {SUPER.contributionsTax * 100}% against your ~{marginal.toFixed(0)}% marginal rate —
              a tax saving of <b>{money(taxSaving)}</b> on {money(boostAnnual)} contributed this year.
            </span>
          </div>
        )}
        <div className="text-terminal-text-dim/50 leading-snug mt-2" style={{ fontSize: 8 }}>
          Salary is held flat and returns are assumed constant, neither of which happens. The concessional cap is
          {' '}{money(SUPER.concessionalCap)} for {TAX_YEAR} and includes employer SG — contributions above it are taxed
          differently and this projection does not model that. Source: {SUPER.source}.
        </div>
      </div>
    </Calc>
  )
}

function SuperTrackCalc() {
  const [age, setAge] = useState('35')
  const [balance, setBalance] = useState('62000')

  // ASFA publishes a lump sum needed AT RETIREMENT, not a by-age ladder. A
  // by-age benchmark is derived here by discounting that lump sum back at a
  // real return — and it is labelled derived, because ASFA does not publish it.
  const r = useMemo(() => {
    const a = num(age)
    const yearsToRetire = Math.max(0, 67 - a)
    const realReturn = 0.045
    const target = ASFA.comfortableSingleLumpSum / (1 + realReturn) ** yearsToRetire
    return { target, gap: num(balance) - target, onTrack: num(balance) >= target, yearsToRetire }
  }, [age, balance])

  return (
    <Calc
      title="ARE YOU ON TRACK?"
      note="against the ASFA comfortable standard"
      inputs={
        <>
          <Field label="CURRENT AGE" value={age} onChange={setAge} />
          <Field label="CURRENT BALANCE" value={balance} onChange={setBalance} suffix="A$" />
        </>
      }
    >
      <Headline
        label="ON TRACK FOR A COMFORTABLE RETIREMENT?"
        value={r.onTrack ? '✓ YES' : '✗ BEHIND'}
        tone={r.onTrack ? '#2D8A50' : '#CC4444'}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Metric label="BENCHMARK AT YOUR AGE" value={money(r.target)} tone="#8BA3C4" />
        <Metric label="YOUR BALANCE" value={money(num(balance))} />
        <Metric label={r.gap >= 0 ? 'AHEAD BY' : 'GAP'} value={money(Math.abs(r.gap))} tone={r.gap >= 0 ? '#2D8A50' : '#CC4444'} />
      </div>
      <div className="text-terminal-text-dim/50 leading-snug mt-3" style={{ fontSize: 8 }}>
        ASFA publishes a lump sum needed AT retirement ({money(ASFA.comfortableSingleLumpSum)} for a single), not a
        by-age ladder. The benchmark above is DERIVED by discounting that figure back to your age at a 4.5% real
        return — it is this terminal&apos;s arithmetic, not an ASFA figure. Benchmarks are general guides and assume
        you own your home outright. Seek advice.
      </div>
    </Calc>
  )
}

// ─── PROPERTY ───────────────────────────────────────────────────────────────

function MortgageCalc() {
  const [price, setPrice] = useState('800000')
  const [depositPct, setDepositPct] = useState('20')
  const [rate, setRate] = useState('6.2')
  const [term, setTerm] = useState('30')
  const [freq, setFreq] = useState('12')

  const r = useMemo(() => {
    const p = num(price), d = num(depositPct)
    const deposit = p * (d / 100)
    const loan = p - deposit
    const per = num(freq, 12)
    const am = amortise(loan, num(rate), num(term), per)
    return { deposit, loan, per, ...am }
  }, [price, depositPct, rate, term, freq])

  const SENSITIVITY = [-1, 0, 1, 2]
  const label = { 12: 'Monthly', 26: 'Fortnightly', 52: 'Weekly' }[r.per] ?? 'Monthly'

  return (
    <Calc
      title="HOME LOAN"
      inputs={
        <>
          <Field label="PROPERTY PRICE" value={price} onChange={setPrice} suffix="A$" />
          <Field label="DEPOSIT" value={depositPct} onChange={setDepositPct} suffix="%" />
          <div className="mb-2.5">
            <span className="font-mono text-terminal-gold/70" style={{ fontSize: 8, letterSpacing: '0.14em' }}>LOAN AMOUNT</span>
            <div className="font-mono font-bold text-terminal-text-bright tabular-nums mt-1" style={{ fontSize: 13 }}>
              {money(r.loan)} <span className="text-terminal-text-dim/50" style={{ fontSize: 10 }}>· deposit {money(r.deposit)}</span>
            </div>
          </div>
          <Field label="INTEREST RATE" value={rate} onChange={setRate} suffix="%" step="0.05" />
          <Field label="LOAN TERM" value={term} onChange={setTerm} suffix="yr" />
          <Field label="REPAYMENT FREQUENCY" value={freq} onChange={setFreq}
            options={[{ value: '12', label: 'Monthly' }, { value: '26', label: 'Fortnightly' }, { value: '52', label: 'Weekly' }]} />
        </>
      }
    >
      <Headline label={`${label.toUpperCase()} REPAYMENT`} value={money(r.payment, 2)} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Metric label="TOTAL REPAYMENTS" value={money(r.totalPaid)} />
        <Metric label="TOTAL INTEREST" value={money(r.totalInterest)} tone="#CC4444" />
        <Metric label="INTEREST AS % OF LOAN" value={`${r.loan > 0 ? ((r.totalInterest / r.loan) * 100).toFixed(1) : '0'}%`} tone="#CC4444" />
        <Metric label="PRINCIPAL EXCEEDS INTEREST" value={r.crossover ? `Year ${Math.ceil(r.crossover / r.per)}` : '—'}
          tip="Until this point more of every repayment goes to the bank than to the loan. On a 30-year loan it is usually well past halfway." />
      </div>

      <div className="font-mono text-terminal-gold/70 mb-1" style={{ fontSize: 8, letterSpacing: '0.14em' }}>WHAT IF RATES CHANGE?</div>
      <table className="terminal-table w-full">
        <thead>
          <tr>
            <th className="px-2 text-left">RATE</th>
            <th className="px-2 text-right">{label.toUpperCase()}</th>
            <th className="px-2 text-right">TOTAL INTEREST</th>
            <th className="px-2 text-right">VS NOW</th>
          </tr>
        </thead>
        <tbody>
          {SENSITIVITY.map((delta) => {
            const rr = num(rate) + delta
            if (rr <= 0) return null
            const am = amortise(r.loan, rr, num(term), r.per)
            const isCurrent = delta === 0
            return (
              <tr key={delta} className="border-b border-terminal-border/30" style={isCurrent ? { background: 'rgba(201,168,76,0.08)' } : undefined}>
                <td className="px-2 py-1 font-mono tabular-nums" style={{ fontSize: 10, color: isCurrent ? '#C9A84C' : '#8BA3C4' }}>
                  {rr.toFixed(2)}%{isCurrent && ' ← current'}
                </td>
                <td className="px-2 py-1 text-right font-mono tabular-nums" style={{ fontSize: 10 }}>{money(am.payment, 0)}</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums" style={{ fontSize: 10 }}>{money(am.totalInterest)}</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums" style={{ fontSize: 10, color: delta === 0 ? '#637899' : delta > 0 ? '#CC4444' : '#2D8A50' }}>
                  {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${money(am.totalInterest - r.totalInterest)}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Calc>
  )
}

function StampDutyCalc() {
  const [state, setState] = useState('QLD')
  const [price, setPrice] = useState('800000')
  const [buyer, setBuyer] = useState('owner')
  const [firstHome, setFirstHome] = useState('no')

  const r = useMemo(() => stampDuty(state, num(price), {
    ownerOccupier: buyer === 'owner', firstHome: firstHome === 'yes',
  }), [state, price, buyer, firstHome])

  return (
    <Calc
      title="STAMP DUTY"
      note="Queensland calculable · other states see below"
      inputs={
        <>
          <Field label="STATE / TERRITORY" value={state} onChange={setState}
            options={Object.entries(STAMP_DUTY).map(([k, v]) => ({ value: k, label: `${k} — ${v.name}${v.calculable ? '' : ' (rates not held)'}` }))} />
          <Field label="PROPERTY PRICE" value={price} onChange={setPrice} suffix="A$" />
          <Field label="BUYER TYPE" value={buyer} onChange={setBuyer}
            options={[{ value: 'owner', label: 'Owner-occupier' }, { value: 'investor', label: 'Investor' }]} />
          <Field label="FIRST HOME BUYER" value={firstHome} onChange={setFirstHome}
            options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} />
        </>
      }
    >
      {r?.calculable ? (
        <>
          <Headline label="STAMP DUTY PAYABLE" value={money(r.duty)} tone={r.exempt ? '#2D8A50' : '#C9A84C'} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Metric label="SCALE APPLIED" value={r.exempt ? 'First home exemption' : r.scale} />
            <Metric label="AS % OF PRICE" value={`${num(price) > 0 ? ((r.duty / num(price)) * 100).toFixed(2) : '0'}%`} />
            <Metric label="TOTAL WITH DUTY" value={money(num(price) + r.duty)} />
          </div>
          <div className="text-terminal-text-dim/60 leading-snug mt-3" style={{ fontSize: 9 }}>
            {r.state.firstHomeNote}
          </div>
          <div className="text-terminal-text-dim/50 leading-snug mt-1" style={{ fontSize: 8 }}>
            Source: {r.state.source}. Checked against two published worked examples — $500,000 → $8,750 and
            $800,000 → $21,850 on the home concession — both reproduce exactly.
          </div>
        </>
      ) : (
        <>
          <Headline label="STAMP DUTY PAYABLE" value="NOT CALCULATED" tone="#637899" />
          <div className="text-terminal-text-dim leading-relaxed" style={{ fontSize: 10, maxWidth: 520 }}>
            The complete band schedule for {r?.state?.name ?? 'this state'} is not recorded in this build, so no
            figure is produced. Stamp duty is a five-figure number people budget against, and a schedule that is
            right at the bottom and estimated above $400,000 — which is where essentially every purchase sits —
            would be confidently wrong exactly where it matters.
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {r?.state?.topRate != null && <Metric label="TOP MARGINAL RATE" value={`${(r.state.topRate * 100).toFixed(2)}%`} tone="#8BA3C4" />}
            {r?.state?.firstHomeFullExemptionTo != null && (
              <Metric label="FIRST HOME EXEMPT TO" value={money(r.state.firstHomeFullExemptionTo)} tone="#2D8A50" />
            )}
          </div>
          {r?.state?.firstHomeNote && (
            <div className="text-terminal-text-dim/60 leading-snug mt-3" style={{ fontSize: 9 }}>{r.state.firstHomeNote}</div>
          )}
          <div className="text-terminal-text-dim/50 leading-snug mt-2" style={{ fontSize: 8 }}>
            Use your state revenue office&apos;s own calculator for a figure you can rely on.
          </div>
        </>
      )}
    </Calc>
  )
}

// ─── TAX ────────────────────────────────────────────────────────────────────

function CgtCalc() {
  const today = new Date().toISOString().slice(0, 10)
  const [buy, setBuy] = useState('25000')
  const [sell, setSell] = useState('48000')
  const [buyDate, setBuyDate] = useState('2022-01-14')
  const [sellDate, setSellDate] = useState(today)
  const [marginal, setMarginal] = useState('37')

  const r = useMemo(() => cgt({
    buy: num(buy), sell: num(sell), buyDate, sellDate, marginalPct: num(marginal),
  }), [buy, sell, buyDate, sellDate, marginal])

  return (
    <Calc
      title="CAPITAL GAINS TAX"
      note={`Australian rules · ${TAX_YEAR}`}
      inputs={
        <>
          <Field label="PURCHASE PRICE" value={buy} onChange={setBuy} suffix="A$" />
          <Field label="SALE PRICE" value={sell} onChange={setSell} suffix="A$" />
          <Field label="PURCHASE DATE" value={buyDate} onChange={setBuyDate} type="date" />
          <Field label="SALE DATE" value={sellDate} onChange={setSellDate} type="date" />
          <Field label="MARGINAL TAX RATE" value={marginal} onChange={setMarginal}
            options={[{ value: '0', label: '0%' }, { value: '15', label: '15%' }, { value: '30', label: '30%' }, { value: '37', label: '37%' }, { value: '45', label: '45%' }]} />
        </>
      }
    >
      <Headline label="NET PROFIT AFTER TAX" value={money(r.net)} tone={r.net >= 0 ? '#2D8A50' : '#CC4444'} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <Metric label="CAPITAL GAIN" value={money(r.gain)} tone={r.gain >= 0 ? '#2D8A50' : '#CC4444'} />
        <Metric label="HELD" value={`${r.heldDays.toLocaleString()} days`} />
        <Metric label="CGT DISCOUNT" value={r.discounted ? '50% applied' : 'Not eligible'} tone={r.discounted ? '#2D8A50' : '#C9A84C'} />
        <Metric label="TAXABLE GAIN" value={money(r.taxable)} />
        <Metric label="TAX PAYABLE" value={money(r.tax)} tone="#CC4444" />
        <Metric label="EFFECTIVE RATE ON GAIN" value={`${r.effective.toFixed(1)}%`} />
      </div>
      <div className="text-terminal-text-dim leading-relaxed" style={{ fontSize: 9 }}>
        {r.discounted
          ? `Held for more than twelve months, so only 50% of the gain is taxed — the CGT discount for Australian individuals. That is why the effective rate on the gain (${r.effective.toFixed(1)}%) is roughly half the marginal rate.`
          : 'Held for twelve months or less, so the whole gain is taxed at your marginal rate. Holding one more day past twelve months would halve the taxable amount.'}
      </div>
      <div className="text-terminal-text-dim/50 leading-snug mt-2" style={{ fontSize: 8 }}>
        The gain is added to your income and can push you into a higher bracket; this uses the single marginal rate
        you select rather than modelling that. Capital losses, the cost base beyond purchase price, and small-business
        concessions are not modelled.
      </div>
    </Calc>
  )
}

function IncomeTaxCalc() {
  const [gross, setGross] = useState('95000')
  const [sacrifice, setSacrifice] = useState('0')
  const [deductions, setDeductions] = useState('2000')

  const r = useMemo(() => fullTaxPosition(num(gross), {
    deductions: num(deductions), salarySacrifice: num(sacrifice),
  }), [gross, deductions, sacrifice])

  const BRACKET_TONE = ['#2D8A50', '#C9A84C', '#D69E2E', '#E07B39', '#CC4444']
  const top = 250000

  return (
    <Calc
      title={`INCOME TAX ${TAX_YEAR}`}
      note={TAX_SOURCE}
      inputs={
        <>
          <Field label="GROSS INCOME" value={gross} onChange={setGross} suffix="A$" />
          <Field label="SALARY SACRIFICE TO SUPER" value={sacrifice} onChange={setSacrifice} suffix="A$" />
          <Field label="WORK DEDUCTIONS" value={deductions} onChange={setDeductions} suffix="A$" />
        </>
      }
    >
      <Headline label="AFTER-TAX INCOME" value={money(r.afterTax)} tone="#2D8A50" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Metric label="TAXABLE INCOME" value={money(r.taxable)} />
        <Metric label="INCOME TAX" value={money(r.tax)} tone="#CC4444" />
        <Metric label="MEDICARE LEVY" value={money(r.medicare)} tone="#CC4444" />
        <Metric label="LOW INCOME OFFSET" value={r.lito > 0 ? `−${money(r.lito)}` : 'Not eligible'} tone={r.lito > 0 ? '#2D8A50' : '#637899'} />
        <Metric label="TOTAL TAX" value={money(r.total)} tone="#CC4444" />
        <Metric label="EFFECTIVE RATE" value={`${r.effective.toFixed(1)}%`} />
        <Metric label="MARGINAL RATE" value={`${r.marginal.toFixed(0)}%`} />
      </div>

      <div className="font-mono text-terminal-gold/70 mb-1" style={{ fontSize: 8, letterSpacing: '0.14em' }}>TAX BRACKETS · {TAX_YEAR}</div>
      <div className="flex h-4 rounded-sm overflow-hidden mb-1">
        {TAX_BRACKETS.map((b, i) => {
          const width = ((Math.min(b.to, top) - b.from) / top) * 100
          return <div key={b.from} style={{ width: `${width}%`, background: BRACKET_TONE[i], opacity: r.taxable > b.from ? 0.85 : 0.25 }} />
        })}
      </div>
      <div className="relative mb-2" style={{ height: 14 }}>
        <div className="absolute" style={{ left: `${Math.min(99, (r.taxable / top) * 100)}%`, transform: 'translateX(-50%)' }}>
          <div className="font-mono text-terminal-gold whitespace-nowrap" style={{ fontSize: 8 }}>▲ you · {money(r.taxable)}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {TAX_BRACKETS.map((b, i) => (
          <span key={b.from} className="font-mono text-terminal-text-dim" style={{ fontSize: 8 }}>
            <span style={{ color: BRACKET_TONE[i] }}>■</span> {money(b.from)}
            {b.to === Infinity ? '+' : `–${money(b.to)}`} · {b.rate === 0 ? 'nil' : `${(b.rate * 100).toFixed(0)}%`}
          </span>
        ))}
      </div>
      <div className="text-terminal-text-dim/50 leading-snug mt-2" style={{ fontSize: 8 }}>
        Resident rates for {TAX_YEAR}. The second bracket fell from 16% to 15% on 1 July 2026. Medicare levy
        surcharge, HELP repayments and offsets other than LITO are not modelled. Source: {TAX_SOURCE}.
      </div>
    </Calc>
  )
}

// ─── LOANS ──────────────────────────────────────────────────────────────────

function LoanComparison() {
  const [loans, setLoans] = useState([
    { principal: '500000', rate: '6.10', term: '30', fee: '600' },
    { principal: '500000', rate: '5.95', term: '30', fee: '1200' },
    { principal: '500000', rate: '6.35', term: '25', fee: '0' },
  ])
  const set = (i, k, v) => setLoans((prev) => prev.map((l, j) => (j === i ? { ...l, [k]: v } : l)))

  const results = loans.map((l) => {
    const p = num(l.principal), r = num(l.rate), t = num(l.term), f = num(l.fee)
    const pay = loanPayment(p, r, t)
    const total = pay * t * 12 + f
    return { pay, total, cost: total - p, f, t }
  })
  const cheapest = results.reduce((best, r, i) => (r.total < results[best].total ? i : best), 0)

  return (
    <Calc
      title="LOAN COMPARISON"
      inputs={
        <>
          {loans.map((l, i) => (
            <div key={i} className="mb-3 pb-2 border-b border-terminal-border/40 last:border-b-0">
              <div className="font-mono text-terminal-gold" style={{ fontSize: 9, letterSpacing: '0.14em' }}>LOAN {i + 1}</div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Field label="PRINCIPAL" value={l.principal} onChange={(v) => set(i, 'principal', v)} suffix="A$" />
                <Field label="RATE" value={l.rate} onChange={(v) => set(i, 'rate', v)} suffix="%" step="0.05" />
                <Field label="TERM" value={l.term} onChange={(v) => set(i, 'term', v)} suffix="yr" />
                <Field label="UPFRONT FEE" value={l.fee} onChange={(v) => set(i, 'fee', v)} suffix="A$" />
              </div>
            </div>
          ))}
        </>
      }
    >
      <table className="terminal-table w-full">
        <thead>
          <tr>
            <th className="px-2 text-left">LOAN</th>
            <th className="px-2 text-right">MONTHLY</th>
            <th className="px-2 text-right">TOTAL COST</th>
            <th className="px-2 text-right">INTEREST + FEES</th>
            <th className="px-2 text-right">VS CHEAPEST</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i} className="border-b border-terminal-border/30"
              style={i === cheapest ? { background: 'rgba(201,168,76,0.1)' } : undefined}>
              <td className="px-2 py-1.5 font-mono font-bold" style={{ fontSize: 10, color: i === cheapest ? '#C9A84C' : '#8BA3C4' }}>
                LOAN {i + 1}{i === cheapest && ' ★'}
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums" style={{ fontSize: 10 }}>{money(r.pay, 2)}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums" style={{ fontSize: 10 }}>{money(r.total)}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums" style={{ fontSize: 10, color: '#CC4444' }}>{money(r.cost)}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums" style={{ fontSize: 10, color: i === cheapest ? '#2D8A50' : '#CC4444' }}>
                {i === cheapest ? '—' : `+${money(r.total - results[cheapest].total)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-terminal-text-dim/50 leading-snug mt-2" style={{ fontSize: 8 }}>
        Total cost is every repayment plus the upfront fee. A shorter term costs less overall while costing more
        each month — the two columns disagree on purpose, and both matter.
      </div>
    </Calc>
  )
}

// Brokerage rates as at the date below. Indicative and easily out of date —
// verify with the broker.
const BROKERS = [
  { name: 'Superhero',          flat: 2.00,  pct: 0,      min: 2.00,  note: 'App' },
  { name: 'Stake',              flat: 3.00,  pct: 0,      min: 3.00,  note: 'App' },
  { name: 'SelfWealth',         flat: 9.50,  pct: 0,      min: 9.50,  note: 'Online' },
  { name: 'Pearler',            flat: 9.50,  pct: 0,      min: 9.50,  note: 'Online' },
  { name: 'CMC Markets',        flat: null,  pct: 0.0011, min: 11.00, note: 'Online' },
  { name: 'CommSec',            flat: null,  pct: 0.0010, min: 19.95, note: 'Full service' },
  { name: 'Interactive Brokers', flat: null, pct: 0.0005, min: 1.50,  note: 'Professional' },
]
const BROKER_AS_AT = 'September 2026'

function BrokerComparison() {
  const [size, setSize] = useState('5000')
  const rows = useMemo(() => {
    const s = num(size)
    return BROKERS
      .map((b) => ({ ...b, cost: Math.max(b.min, b.flat != null ? b.flat : s * b.pct), pctOfTrade: s > 0 ? (Math.max(b.min, b.flat != null ? b.flat : s * b.pct) / s) * 100 : 0 }))
      .sort((a, b) => a.cost - b.cost)
  }, [size])

  return (
    <Calc
      title="BROKERAGE COMPARISON"
      note={`indicative · as at ${BROKER_AS_AT}`}
      inputs={<Field label="TRADE SIZE" value={size} onChange={setSize} suffix="A$" />}
    >
      <table className="terminal-table w-full">
        <thead>
          <tr>
            <th className="px-2 text-left">BROKER</th>
            <th className="px-2 text-left">TYPE</th>
            <th className="px-2 text-right">COST</th>
            <th className="px-2 text-right">% OF TRADE</th>
            <th className="px-2 text-right">ROUND TRIP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b, i) => (
            <tr key={b.name} className="border-b border-terminal-border/30" style={i === 0 ? { background: 'rgba(201,168,76,0.1)' } : undefined}>
              <td className="px-2 py-1.5 font-mono font-bold" style={{ fontSize: 10, color: i === 0 ? '#C9A84C' : '#E6EDF6' }}>
                {b.name}{i === 0 && ' ★'}
              </td>
              <td className="px-2 py-1.5 font-mono text-terminal-text-dim" style={{ fontSize: 9 }}>{b.note}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums" style={{ fontSize: 10 }}>{money(b.cost, 2)}</td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums" style={{ fontSize: 10, color: b.pctOfTrade > 0.4 ? '#CC4444' : b.pctOfTrade > 0.15 ? '#C9A84C' : '#2D8A50' }}>
                {b.pctOfTrade.toFixed(3)}%
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums text-terminal-text-dim" style={{ fontSize: 10 }}>{money(b.cost * 2, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-terminal-text-dim/50 leading-snug mt-2" style={{ fontSize: 8 }}>
        ROUND TRIP is buying and selling — the figure that actually decides whether a small parcel is worth it.
        Fees are indicative as at {BROKER_AS_AT} and change; several brokers also charge FX, custody or inactivity
        fees not shown here. Verify current fees directly with each broker.
      </div>
    </Calc>
  )
}

// ─── Module ─────────────────────────────────────────────────────────────────

const DISCLAIMER = `These calculators are for educational purposes and general information only. Results are estimates based on the assumptions you enter. Not financial, tax, or legal advice. Always consult a licensed professional for personal advice.`

export default function CalculatorsModule() {
  const [tab, setTab] = useState('investment')

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ModuleHeader
        title="CALCULATORS"
        subtitle="Investment · Super · Property · Tax · Loans"
        moduleId="calculators"
        right={<span className="text-terminal-text-dim text-2xs font-normal normal-case">{TAX_YEAR} rates</span>}
      />
      <TabBar tabs={TABS} activeKey={tab} onChange={setTab} />

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'investment' && <><CompoundCalc /><DrpCalc /><BrokerageCalc /></>}
        {tab === 'super' && <><SuperCalc /><SuperTrackCalc /></>}
        {tab === 'property' && <><MortgageCalc /><StampDutyCalc /></>}
        {tab === 'tax' && <><IncomeTaxCalc /><CgtCalc /></>}
        {tab === 'loans' && <><LoanComparison /><BrokerComparison /></>}

        <div className="border border-terminal-border/50 px-3 py-2 text-terminal-text-dim/60 leading-relaxed" style={{ fontSize: 9 }}>
          {DISCLAIMER}
        </div>
      </div>
    </div>
  )
}
