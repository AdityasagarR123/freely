import { join } from 'node:path'
import { app, BrowserWindow, Menu, nativeImage, screen, shell, Tray, type Display, type Rectangle } from 'electron'
import { MOVE_STEP_PX, WINDOW_SIZE } from '../shared/defaults'
import { getBounds, getSettings, saveBounds } from './store'

const here = import.meta.dirname
const preloadPath = join(here, '../preload/index.cjs')
const regionPreloadPath = join(here, '../preload/region.cjs')

let overlay: BrowserWindow | null = null
let tray: Tray | null = null
let clickThrough = false

/** Loads a renderer page from the Vite dev server in development, from disk when built. */
function loadPage(win: BrowserWindow, page: 'index' | 'region', hash = ''): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) void win.loadURL(`${devUrl}/${page}.html${hash}`)
  else void win.loadFile(join(here, `../renderer/${page}.html`), { hash: hash.replace(/^#/, '') })
}

/** Locks a window down: no navigation, no popups, links open in the real browser. */
function harden(win: BrowserWindow): void {
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
}

function defaultBounds(): Rectangle {
  const wa = screen.getPrimaryDisplay().workArea
  return { x: wa.x + wa.width - WINDOW_SIZE.width - 24, y: wa.y + 24, ...WINDOW_SIZE }
}

/** Saved bounds, if they are still at least partly on a connected display. */
function restoredBounds(): Rectangle {
  const saved = getBounds()
  if (!saved) return defaultBounds()
  const visible = screen
    .getAllDisplays()
    .some(
      ({ workArea: wa }) =>
        saved.x < wa.x + wa.width - 60 &&
        saved.x + saved.width > wa.x + 60 &&
        saved.y >= wa.y - 10 &&
        saved.y < wa.y + wa.height - 60,
    )
  return visible ? saved : defaultBounds()
}

export function createOverlay(): BrowserWindow {
  const settings = getSettings()
  overlay = new BrowserWindow({
    ...restoredBounds(),
    minWidth: 340,
    minHeight: 300,
    frame: false,
    transparent: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    title: 'Freely',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Keep audio capture and streaming running while the overlay is hidden.
      backgroundThrottling: false,
    },
  })
  overlay.setAlwaysOnTop(true, 'floating')
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlay.setOpacity(settings.opacity)
  overlay.setContentProtection(settings.hideFromCapture)
  harden(overlay)

  let saveTimer: NodeJS.Timeout | undefined
  const persist = (): void => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => overlay && !overlay.isDestroyed() && saveBounds(overlay.getBounds()), 400)
  }
  overlay.on('moved', persist)
  overlay.on('resized', persist)
  overlay.once('ready-to-show', () => overlay?.show())
  overlay.on('closed', () => (overlay = null))
  loadPage(overlay, 'index')
  return overlay
}

export function getOverlay(): BrowserWindow | null {
  return overlay && !overlay.isDestroyed() ? overlay : null
}

export function showOverlay(): void {
  const win = getOverlay()
  if (!win) return
  win.show()
  win.setAlwaysOnTop(true, 'floating')
  win.focus()
}

export function toggleOverlay(): void {
  const win = getOverlay()
  if (!win) return
  if (win.isVisible()) win.hide()
  else showOverlay()
}

export function moveOverlay(dx: number, dy: number): void {
  const win = getOverlay()
  if (!win) return
  const [x, y] = win.getPosition()
  win.setPosition(x + dx * MOVE_STEP_PX, y + dy * MOVE_STEP_PX)
}

export function toggleClickThrough(): boolean {
  const win = getOverlay()
  if (!win) return clickThrough
  clickThrough = !clickThrough
  // forward: true keeps hover events flowing so the page can still render the badge.
  win.setIgnoreMouseEvents(clickThrough, { forward: true })
  win.webContents.send('clickthrough', clickThrough)
  return clickThrough
}

/** Applies settings that live on the window itself. */
export function applyWindowSettings(): void {
  const s = getSettings()
  const win = getOverlay()
  win?.setOpacity(s.opacity)
  win?.setContentProtection(s.hideFromCapture)
}

function resourcePath(file: string): string {
  return app.isPackaged ? join(process.resourcesPath, file) : join(app.getAppPath(), 'resources', file)
}

export function createTray(onSettings: () => void): void {
  const icon = nativeImage.createFromPath(resourcePath(process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('Freely')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show / Hide', click: toggleOverlay },
      { label: 'Settings', click: onSettings },
      { type: 'separator' },
      { label: 'Quit Freely', click: () => app.quit() },
    ]),
  )
  tray.on('click', toggleOverlay)
}

/**
 * Opens a full-screen selector on `display` showing a frozen screenshot, and resolves with
 * the rectangle the user dragged (in display CSS pixels), or null if they cancelled.
 */
export function openRegionSelector(
  display: Display,
  register: (win: BrowserWindow, resolve: (r: Rectangle | null) => void) => void,
): Promise<Rectangle | null> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      ...display.bounds,
      frame: false,
      transparent: false,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      enableLargerThanScreen: true,
      show: false,
      backgroundColor: '#000000',
      webPreferences: { preload: regionPreloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true },
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setContentProtection(getSettings().hideFromCapture)
    harden(win)
    let settled = false
    const finish = (r: Rectangle | null): void => {
      if (settled) return
      settled = true
      resolve(r)
      if (!win.isDestroyed()) win.close()
    }
    win.on('closed', () => finish(null))
    register(win, finish)
    win.once('ready-to-show', () => {
      win.setBounds(display.bounds)
      win.show()
      win.focus()
    })
    loadPage(win, 'region')
  })
}
