import { desktopCapturer, screen, type BrowserWindow, type Display, type NativeImage, type Rectangle } from 'electron'
import { SCREENSHOT_JPEG_QUALITY, SCREENSHOT_MAX_WIDTH } from '../shared/defaults'
import type { Attachment } from '../shared/types'
import { getOverlay, openRegionSelector } from './windows'

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** The display the mouse cursor is currently on. */
export function cursorDisplay(): Display {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

/** Full-resolution image of one display. */
async function grabDisplay(display: Display): Promise<NativeImage> {
  const { width, height } = display.size
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width * display.scaleFactor), height: Math.round(height * display.scaleFactor) },
  })
  const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  if (!source || source.thumbnail.isEmpty()) {
    throw new Error('Screen capture returned nothing. On macOS, allow Screen Recording for Freely.')
  }
  return source.thumbnail
}

/** Hides the overlay so it isn't in the shot, runs `fn`, then brings the overlay back. */
async function withOverlayHidden<T>(fn: () => Promise<T>): Promise<T> {
  const win = getOverlay()
  const wasVisible = !!win?.isVisible()
  if (wasVisible) {
    win?.hide()
    await wait(180) // let the window manager finish the hide animation
  }
  try {
    return await fn()
  } finally {
    if (wasVisible) win?.show()
  }
}

/** Downscales to at most 1920 px wide and encodes as JPEG. */
export function toAttachment(img: NativeImage): Attachment {
  const { width } = img.getSize()
  const scaled = width > SCREENSHOT_MAX_WIDTH ? img.resize({ width: SCREENSHOT_MAX_WIDTH, quality: 'good' }) : img
  return { dataUrl: `data:image/jpeg;base64,${scaled.toJPEG(SCREENSHOT_JPEG_QUALITY).toString('base64')}` }
}

export async function captureScreen(): Promise<Attachment> {
  const display = cursorDisplay()
  return toAttachment(await withOverlayHidden(() => grabDisplay(display)))
}

let pendingRegion: { image: string; resolve: (r: Rectangle | null) => void; win: BrowserWindow } | null = null

/** Region screenshot: freeze the screen, let the user drag a rectangle, crop to it. */
export async function captureRegion(): Promise<Attachment | null> {
  const display = cursorDisplay()
  const win = getOverlay()
  const wasVisible = !!win?.isVisible()
  if (wasVisible) {
    win?.hide()
    await wait(180)
  }
  try {
    const img = await grabDisplay(display)
    const rect = await openRegionSelector(display, (selector, resolve) => {
      pendingRegion = { image: img.toDataURL(), resolve, win: selector }
    })
    pendingRegion = null
    if (!rect || rect.width < 4 || rect.height < 4) return null
    const scale = img.getSize().width / display.bounds.width
    const cropped = img.crop({
      x: Math.round(rect.x * scale),
      y: Math.round(rect.y * scale),
      width: Math.round(rect.width * scale),
      height: Math.round(rect.height * scale),
    })
    return toAttachment(cropped)
  } finally {
    pendingRegion = null
    if (wasVisible) win?.show()
  }
}

/** Only the selector window that is currently open may read the frozen image or finish selection. */
export function regionImageFor(senderId: number): string {
  return pendingRegion && pendingRegion.win.webContents.id === senderId ? pendingRegion.image : ''
}

export function regionDone(senderId: number, rect: Rectangle | null): void {
  if (pendingRegion && pendingRegion.win.webContents.id === senderId) pendingRegion.resolve(rect)
}
