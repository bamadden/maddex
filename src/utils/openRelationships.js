import { sendModuleIntent } from '../services/moduleIntent'

// Opens the Relationships module focused on a node. The caller passes its
// store's setActiveModule (the store is context-based, so there is no global
// handle to reach for here).
export function openInRelationships(setActiveModule, nodeId) {
  sendModuleIntent('relationships', { focus: nodeId })
  setActiveModule('relationships')
}

// Opens the company profile for a company node (its id is its ASX ticker).
export function openCompanyProfile(setActiveModule, nodeId) {
  sendModuleIntent('company', { id: nodeId })
  setActiveModule('company')
}

// Company nodes are keyed by bare ticker; other node types carry a prefix.
export const isCompanyNodeId = (id) => !!id && !id.includes(':')
