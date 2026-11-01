// Review-queue settings. Changing the spot-check size is a reviewed code
// change: base it on the override rate in docs/GRAPH_QUALITY.md
// (npm run graph:report).

// "Approve all agreed" first asks the reviewer to check this many randomly
// chosen AGREED items (all of them, when there are fewer). One marked wrong
// cancels the batch.
export const SPOT_CHECK_SIZE = 5
