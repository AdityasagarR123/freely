/** Minimal bridge for the region-selector window. */
import { contextBridge, ipcRenderer } from 'electron'
import type { RegionApi } from '../shared/types'

const api: RegionApi = {
  getImage: () => ipcRenderer.invoke('region:image'),
  done: (rect) => ipcRenderer.send('region:done', rect),
}

contextBridge.exposeInMainWorld('freelyRegion', api)
