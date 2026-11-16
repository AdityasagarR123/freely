import { DEFAULT_HOTKEYS, DEFAULT_SETTINGS, SETTINGS_VERSION } from './defaults'
import type { Settings } from './types'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/**
 * Turns whatever is on disk into a valid, current Settings object.
 * v1 → v2: `model` was renamed to `textModel`, and `opacity` was stored as 40–100 instead of 0.4–1.
 * Unknown keys are dropped; missing or wrongly-typed keys get defaults.
 */
export function migrateSettings(raw: unknown): Settings {
  const src: Record<string, unknown> = isObj(raw) ? { ...raw } : {}
  const version = typeof src.version === 'number' ? src.version : 1

  if (version < 2) {
    if (typeof src.model === 'string' && !src.textModel) src.textModel = src.model
    if (typeof src.opacity === 'number' && src.opacity > 1) src.opacity = src.opacity / 100
  }
  // v2 → v3: the old move defaults (Ctrl+Arrow) hijacked word-jumping in every app; drop them so the new defaults apply.
  if (version < 3 && isObj(src.hotkeys)) {
    const hk: Record<string, unknown> = { ...src.hotkeys }
    for (const [action, dir] of [
      ['moveUp', 'Up'],
      ['moveDown', 'Down'],
      ['moveLeft', 'Left'],
      ['moveRight', 'Right'],
    ]) {
      if (hk[action] === `CommandOrControl+${dir}`) delete hk[action]
    }
    src.hotkeys = hk
  }

  const out = { ...DEFAULT_SETTINGS, hotkeys: { ...DEFAULT_HOTKEYS } } as Settings
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (key === 'hotkeys' || key === 'version') continue
    const value = src[key]
    if (value !== undefined && typeof value === typeof DEFAULT_SETTINGS[key]) {
      ;(out as unknown as Record<string, unknown>)[key] = value
    }
  }
  if (isObj(src.hotkeys)) {
    for (const action of Object.keys(DEFAULT_HOTKEYS) as (keyof Settings['hotkeys'])[]) {
      const v = src.hotkeys[action]
      if (typeof v === 'string') out.hotkeys[action] = v
    }
  }
  out.opacity = Math.min(1, Math.max(0.4, out.opacity))
  if (!['short', 'normal', 'detailed'].includes(out.responseLength)) out.responseLength = 'normal'
  if (!['mic', 'system', 'both'].includes(out.audioSource)) out.audioSource = 'both'
  if (!['dark', 'light'].includes(out.theme)) out.theme = 'dark'
  if (!out.textModel.trim()) out.textModel = DEFAULT_SETTINGS.textModel
  if (!out.liveModel.trim()) out.liveModel = DEFAULT_SETTINGS.liveModel
  out.version = SETTINGS_VERSION
  return out
}
