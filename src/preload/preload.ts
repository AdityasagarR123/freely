/** The typed bridge between the sandboxed renderer and the main process. */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { FreelyApi } from '../shared/types'

/** Subscribes to a main → renderer channel and returns an unsubscribe function. */
function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: FreelyApi = {
  platform: process.platform,
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  setApiKey: (key) => ipcRenderer.invoke('key:set', key),
  testApiKey: (key) => ipcRenderer.invoke('key:test', key),

  chatSend: (requestId, messages) => ipcRenderer.invoke('chat:send', requestId, messages),
  chatAbort: (requestId) => ipcRenderer.invoke('chat:abort', requestId),
  complete: (prompt, attachments) => ipcRenderer.invoke('chat:complete', prompt, attachments),

  captureScreen: () => ipcRenderer.invoke('capture:screen'),
  captureRegion: () => ipcRenderer.invoke('capture:region'),
  screenPermission: () => ipcRenderer.invoke('perm:screen'),
  openScreenSettings: () => ipcRenderer.invoke('perm:openScreenSettings'),
  requestMicAccess: () => ipcRenderer.invoke('perm:mic'),

  listenStart: (sources) => ipcRenderer.invoke('listen:start', sources),
  listenStop: () => ipcRenderer.invoke('listen:stop'),
  sendAudio: (speaker, pcm) => ipcRenderer.send('listen:audio', speaker, pcm),
  saveTranscript: (markdown) => ipcRenderer.invoke('transcript:save', markdown),

  listChats: () => ipcRenderer.invoke('chats:list'),
  loadChat: (id) => ipcRenderer.invoke('chats:load', id),
  saveChat: (chat) => ipcRenderer.invoke('chats:save', chat),
  deleteChat: (id) => ipcRenderer.invoke('chats:delete', id),
  clearChats: () => ipcRenderer.invoke('chats:clear'),

  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  hideOverlay: () => ipcRenderer.invoke('app:hide'),
  quitApp: () => ipcRenderer.invoke('app:quit'),

  onStream: (cb) => on('chat:stream', cb),
  onListen: (cb) => on('listen:event', cb),
  onHotkey: (cb) => on('hotkey', cb),
  onClickThrough: (cb) => on('clickthrough', cb),
  onSettings: (cb) => on('settings', cb),
}

contextBridge.exposeInMainWorld('freely', api)
