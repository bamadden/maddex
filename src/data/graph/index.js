// The loaded graph: seed nodes and edges plus the edges a person approved in
// the review queue (approved.json), all passed through the provenance gate in
// schema.js. Import this, never the raw seed files, anywhere that draws or
// queries the graph.

import { loadGraph } from './schema'
import { ALL_NODES } from './nodes'
import { EDGES } from './edges'
import APPROVED from './approved.json'

export const GRAPH = loadGraph([...ALL_NODES, ...APPROVED.nodes], [...EDGES, ...APPROVED.edges])
