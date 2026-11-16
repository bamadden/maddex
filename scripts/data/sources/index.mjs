// Every source with a fetcher. Add a source here and in the registry.
import * as rba from './rba.mjs'
import * as abs from './abs.mjs'
import * as bls from './bls.mjs'
import * as ecb from './ecb.mjs'
import * as boc from './boc.mjs'

export const SOURCES = { rba, abs, bls, ecb, boc }
