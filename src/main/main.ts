import { app, desktopCapturer, globalShortcut, session } from 'electron'
import type { HotkeyAction } from '../shared/types'
import { stopListening } from './audio/listener'
import { registerHotkeys } from './hotkeys'
import { publicSettings, registerIpc, setHotkeyErrors } from './ipc'
import { getSettings, onSettingsChanged } from './store'
import {
  applyWindowSettings,
  createOverlay,
  createTray,
  getOverlay,
  moveOverlay,
  showOverlay,
  toggleClickThrough,
  toggleOverlay,
} from './windows'

// One instance only: a second launch just shows the existing overlay.
if (!app.requestSingleInstanceLock()) app.quit()

/** Hotkeys that the main process handles itself; the rest are forwarded to the renderer. */
function onHotkey(action: HotkeyAction): void {
  switch (action) {
    case 'toggleOverlay':
      return toggleOverlay()
    case 'clickThrough':
      return void toggleClickThrough()
    case 'moveUp':
      return moveOverlay(0, -1)
    case 'moveDown':
      return moveOverlay(0, 1)
    case 'moveLeft':
      return moveOverlay(-1, 0)
    case 'moveRight':
      return moveOverlay(1, 0)
    default:
      if (action !== 'toggleListen' && action !== 'screenshotAsk' && action !== 'regionShot') showOverlay()
      getOverlay()?.webContents.send('hotkey', action)
  }
}

function applyHotkeys(): void {
  setHotkeyErrors(registerHotkeys(getSettings().hotkeys, onHotkey))
}

function applyLoginItem(): void {
  if (process.platform === 'linux') return // not supported by Electron on Linux
  app.setLoginItemSettings({ openAtLogin: getSettings().launchAtLogin })
}

const ALLOWED_PERMISSIONS = new Set(['media', 'display-capture', 'clipboard-sanitized-write'])

/** Only our own pages get mic / screen / clipboard-write access; every other permission is denied. */
function setupPermissions(): void {
  const ses = session.defaultSession
  const devUrl = process.env.ELECTRON_RENDERER_URL
  const trusted = (url: string): boolean => url.startsWith('file://') || (!!devUrl && url.startsWith(devUrl))
  ses.setPermissionRequestHandler((wc, permission, cb) =>
    cb(ALLOWED_PERMISSIONS.has(permission) && trusted(wc.getURL())),
  )
  ses.setPermissionCheckHandler((wc, permission) => ALLOWED_PERMISSIONS.has(permission) && !!wc && trusted(wc.getURL()))

  // System audio: getDisplayMedia() in the renderer is answered with the screen + OS loopback audio.
  // The video track is discarded by the renderer; only the audio is used.
  ses.setDisplayMediaRequestHandler(
    (_req, cb) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => cb(sources[0] ? { video: sources[0], audio: 'loopback' } : {}))
        .catch(() => cb({}))
    },
    { useSystemPicker: false },
  )
}

app.on('second-instance', showOverlay)

void app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.hide()
  setupPermissions()
  registerIpc()
  createOverlay()
  createTray(() => {
    showOverlay()
    getOverlay()?.webContents.send('hotkey', 'openSettings')
  })
  applyHotkeys()
  applyLoginItem()

  onSettingsChanged((s, prev) => {
    applyWindowSettings()
    if (JSON.stringify(s.hotkeys) !== JSON.stringify(prev.hotkeys)) applyHotkeys()
    if (s.launchAtLogin !== prev.launchAtLogin) applyLoginItem()
    getOverlay()?.webContents.send('settings', publicSettings())
  })
})

// The overlay lives in the tray, so closing every window doesn't quit.
app.on('window-all-closed', () => {})
app.on('before-quit', stopListening)
app.on('will-quit', () => globalShortcut.unregisterAll())
