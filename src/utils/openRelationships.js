import { sendModuleIntent } from '../services/moduleIntent'

// Opens the Relationships module focused on a node. The caller passes its
// store's setActiveModule (the store is context-based, so there is no global
// handle to reach for here).
export function openInRelationships(setActiveModule, nodeId) {
  sendModuleIntent('relationships', { focus: nodeId })
  setActiveModule('relationships')
}
