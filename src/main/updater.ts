/**
 * Auto-update from this project's GitHub Releases (configured under `publish` in electron-builder.yml).
 * This is the one network call besides Gemini, and it can be turned off in Settings.
 * Updates download in the background and install the next time Freely quits.
 */
import { app } from 'electron'
import updaterPkg from 'electron-updater'
import { getSettings } from './store'

const { autoUpdater } = updaterPkg
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

let timer: NodeJS.Timeout | null = null

function check(): void {
  if (!getSettings().autoUpdate) return
  // Offline or no release yet: try again at the next interval.
  autoUpdater.checkForUpdatesAndNotify().catch(() => {})
}

export function startAutoUpdates(): void {
  if (!app.isPackaged || timer) return // dev builds have nothing to update
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  check()
  timer = setInterval(check, CHECK_EVERY_MS)
}

/** Called when the user turns the setting back on. */
export function checkForUpdatesNow(): void {
  if (app.isPackaged) check()
}
