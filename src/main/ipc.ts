import { writeFile } from 'node:fs/promises'
import { app, dialog, ipcMain, shell, systemPreferences, type IpcMainInvokeEvent, type Rectangle } from 'electron'
import type { Attachment, ChatMessage, ChatSession, PublicSettings, Settings, Speaker } from '../shared/types'
import { pushAudio, startListening, stopListening } from './audio/listener'
import { captureRegion, captureScreen, regionDone, regionImageFor } from './capture'
import { clearChats, deleteChat, listChats, loadChat, saveChat } from './chats'
import { abortChat, complete, streamChat, testKey } from './gemini'
import { getApiKey, getSettings, isKeyInsecure, setApiKey, updateSettings } from './store'
import { getOverlay } from './windows'

let hotkeyErrors: string[] = []

export function setHotkeyErrors(errors: string[]): void {
  hotkeyErrors = errors
}

export function publicSettings(): PublicSettings {
  return { settings: getSettings(), hasKey: !!getApiKey(), keyInsecure: isKeyInsecure(), hotkeyErrors }
}

/** Only the overlay window may call privileged handlers. */
function fromOverlay(e: IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
  return e.sender === getOverlay()?.webContents
}

function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => R | Promise<R>): void {
  ipcMain.handle(channel, (e, ...args) => {
    if (!fromOverlay(e)) throw new Error('Unauthorized sender')
    return fn(...(args as A))
  })
}

export function registerIpc(): void {
  handle('settings:get', () => publicSettings())
  handle('settings:update', (patch: Partial<Settings>) => {
    updateSettings(patch)
    return publicSettings()
  })
  handle('key:set', (key: string) => {
    setApiKey(String(key ?? ''))
    return publicSettings()
  })
  handle('key:test', (key?: string) => testKey(key))

  handle('chat:send', (requestId: string, messages: ChatMessage[]) =>
    streamChat(requestId, messages, (ev) => getOverlay()?.webContents.send('chat:stream', ev)),
  )
  handle('chat:abort', (requestId: string) => abortChat(requestId))
  handle('chat:complete', (prompt: string, attachments?: Attachment[]) => complete(prompt, attachments))

  handle('capture:screen', async () => {
    try {
      return await captureScreen()
    } catch {
      return null
    }
  })
  handle('capture:region', async () => {
    try {
      return await captureRegion()
    } catch {
      return null
    }
  })
  handle('perm:screen', () => ({
    status: process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'granted',
    platform: process.platform,
  }))
  handle('perm:openScreenSettings', () =>
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'),
  )
  handle('perm:mic', async () =>
    process.platform === 'darwin' ? systemPreferences.askForMediaAccess('microphone') : true,
  )

  handle('listen:start', async (speakers: Speaker[]) => ({
    mode: await startListening(speakers, (ev) => getOverlay()?.webContents.send('listen:event', ev)),
  }))
  handle('listen:stop', () => stopListening())
  // Audio is high-frequency, so it uses fire-and-forget `send` rather than `invoke`.
  ipcMain.on('listen:audio', (e, speaker: Speaker, pcm: ArrayBuffer) => {
    if (fromOverlay(e) && (speaker === 'you' || speaker === 'others') && pcm instanceof ArrayBuffer)
      pushAudio(speaker, pcm)
  })
  handle('transcript:save', async (markdown: string) => {
    const win = getOverlay()
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    const opts = {
      title: 'Save transcript',
      defaultPath: `${app.getPath('documents')}/freely-transcript-${stamp}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    }
    const { canceled, filePath } = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (canceled || !filePath) return null
    await writeFile(filePath, String(markdown), 'utf8')
    return filePath
  })

  handle('chats:list', () => listChats())
  handle('chats:load', (id: string) => loadChat(id))
  handle('chats:save', (chat: ChatSession) => (getSettings().saveHistory ? saveChat(chat) : undefined))
  handle('chats:delete', (id: string) => deleteChat(id))
  handle('chats:clear', () => clearChats())

  handle('app:openExternal', (url: string) => {
    if (/^https:\/\//.test(url)) return shell.openExternal(url)
  })
  handle('app:hide', () => getOverlay()?.hide())

  // Region selector window (its own preload, its own narrow API).
  ipcMain.handle('region:image', (e) => regionImageFor(e.sender.id))
  ipcMain.on('region:done', (e, rect: Rectangle | null) => regionDone(e.sender.id, rect))
}
