import { SCREENSHOT_JPEG_QUALITY, SCREENSHOT_MAX_WIDTH } from '../../shared/defaults'
import type { Attachment } from '../../shared/types'

export const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Downscales a pasted image to the same size/quality rules as screenshots. */
export async function imageFileToAttachment(file: Blob): Promise<Attachment> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, SCREENSHOT_MAX_WIDTH / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return { dataUrl: canvas.toDataURL('image/jpeg', SCREENSHOT_JPEG_QUALITY / 100) }
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

/** Strips Electron's "Error invoking remote method …" wrapper from errors thrown by main-process handlers. */
export function ipcErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}
