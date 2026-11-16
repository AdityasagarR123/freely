import { safeStorage, type Rectangle } from 'electron'
import Store from 'electron-store'
import { migrateSettings } from '../shared/settings'
import type { Settings } from '../shared/types'

interface Schema {
  settings?: unknown
  /** API key encrypted with safeStorage, base64. */
  apiKeyEnc?: string
  /** Only used when the OS offers no encryption (some Linux setups). */
  apiKeyPlain?: string
  bounds?: Rectangle
}

const store = new Store<Schema>({ name: 'freely-settings' })
let cached: Settings = migrateSettings(store.get('settings'))
store.set('settings', cached)

const listeners = new Set<(s: Settings, prev: Settings) => void>()

export function getSettings(): Settings {
  return cached
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const prev = cached
  cached = migrateSettings({ ...cached, ...patch, hotkeys: { ...cached.hotkeys, ...patch.hotkeys } })
  store.set('settings', cached)
  listeners.forEach((fn) => fn(cached, prev))
  return cached
}

export function onSettingsChanged(fn: (s: Settings, prev: Settings) => void): void {
  listeners.add(fn)
}

export function getApiKey(): string | null {
  const enc = store.get('apiKeyEnc')
  if (enc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(enc, 'base64'))
    } catch {
      return null
    }
  }
  return store.get('apiKeyPlain') || null
}

/** Saves the key encrypted with the OS keychain when possible; an empty key deletes it. */
export function setApiKey(key: string): void {
  store.delete('apiKeyEnc')
  store.delete('apiKeyPlain')
  const trimmed = key.trim()
  if (!trimmed) return
  if (safeStorage.isEncryptionAvailable()) {
    store.set('apiKeyEnc', safeStorage.encryptString(trimmed).toString('base64'))
  } else {
    store.set('apiKeyPlain', trimmed)
  }
}

export function isKeyInsecure(): boolean {
  return !!store.get('apiKeyPlain')
}

export function getBounds(): Rectangle | undefined {
  return store.get('bounds')
}

export function saveBounds(bounds: Rectangle): void {
  store.set('bounds', bounds)
}
