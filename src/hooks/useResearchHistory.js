import { useEffect, useState } from 'react'
import { listNoteHistory, NOTES_CHANGED_EVENT } from '../services/researchNoteService'

// The saved research notes, kept current across saves, deletes and other tabs.
export function useResearchHistory() {
  const [notes, setNotes] = useState(listNoteHistory)
  useEffect(() => {
    const sync = () => setNotes(listNoteHistory())
    window.addEventListener(NOTES_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(NOTES_CHANGED_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])
  return notes
}
