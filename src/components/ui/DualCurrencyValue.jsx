import { useProfile } from '../../hooks/useProfile'
import { CURRENCY_SYMBOLS } from '../../store/useAuthStore'

const SIZE_CLASSES = {
  sm: { primary: 'text-2xs', secondary: 'text-2xs' },
  md: { primary: 'text-xs', secondary: 'text-2xs' },
  lg: { primary: 'text-sm', secondary: 'text-xs' },
  xl: { primary: 'text-2xl', secondary: 'text-sm' },
}

// amount/currency are the native (source) value — e.g. a US-listed stock is
// { amount: 333.74, currency: 'USD' }. The secondary line (if shown) is that
// value converted into the signed-in user's preferred_currency.
export default function DualCurrencyValue({
  amount,
  currency,
  size = 'md',
  showSecondary,
  className = '',
  positiveColour = false,
  negativeColour = false,
}) {
  const { profile, convertAmount } = useProfile()

  const symbol = CURRENCY_SYMBOLS[currency] || currency
  const sizes = SIZE_CLASSES[size]

  const primaryColour = positiveColour
    ? 'text-terminal-green'
    : negativeColour
    ? 'text-terminal-red'
    : 'text-terminal-text-bright'

  const formatted = amount.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  })

  const secondary = profile?.show_secondary_currency !== false && showSecondary !== false
    ? convertAmount(amount, currency)
    : null

  return (
    <span className={`inline-flex flex-col leading-tight font-mono ${className}`}>
      <span className={`${sizes.primary} font-bold ${primaryColour}`}>
        {symbol}{formatted}
      </span>
      {secondary && (
        <span className={`${sizes.secondary} text-terminal-text-dim mt-0.5`}>
          {secondary.display}
        </span>
      )}
    </span>
  )
}

// Convenience wrapper for table cells that also carry a % change.
export function PriceCell({ amount, currency, change }) {
  return (
    <DualCurrencyValue
      amount={amount}
      currency={currency}
      size="sm"
      positiveColour={change !== undefined && change > 0}
      negativeColour={change !== undefined && change < 0}
    />
  )
}
