import { setModuleIntent } from '../../services/moduleIntent'

// SCREEN THIS SECTOR — open the Screener with its sector filter set. The
// screener reads the intent on mount (see ScreenerModule's filters state).
export function screenSector(sector, setActiveModule) {
  setModuleIntent('screener', { sector })
  setActiveModule?.('screener')
}
