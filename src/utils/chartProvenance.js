// Provenance for charts drawn from equity prices (WS3): DEMO while prices are
// simulated, DELAYED with the provider once a licensed feed is connected.
// `at` is when the data was fetched or simulated.
import { USING_MOCK_DATA, EQUITY_SOURCE } from '../services/api'

export function equityProvenance(at = Date.now(), what = 'prices') {
  return USING_MOCK_DATA
    ? { cls: 'DEMO', source: `${what} simulated`, at }
    : { cls: 'DELAYED', source: `${what}: ${EQUITY_SOURCE}`, at }
}
