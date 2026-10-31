// The loaded graph: seed nodes and edges, passed through the provenance gate
// in schema.js. Import this, never the raw seed files, anywhere that draws or
// queries the graph.

import { loadGraph } from './schema'
import { ALL_NODES } from './nodes'
import { EDGES } from './edges'

export const GRAPH = loadGraph(ALL_NODES, EDGES)
