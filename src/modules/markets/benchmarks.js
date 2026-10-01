// The benchmark set the Markets index bar shows, in display order. Shared by
// the index bar and the volatility banner so both read the same cached quote
// batch (queryKey ['yfBatch', 'indices']) rather than two lists that drift.
export const BENCHMARK_ORDER = [
  '^AXJO', '^AORD', '^GSPC', '^IXIC', '^DJI', '^FTSE', '^N225', '^HSI', '^GDAXI', '000001.SS',
]
