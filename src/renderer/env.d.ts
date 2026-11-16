/// <reference types="vite/client" />
import type { FreelyApi, RegionApi } from '../shared/types'

declare global {
  interface Window {
    freely: FreelyApi
    freelyRegion: RegionApi
  }
}
