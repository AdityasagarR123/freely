import { globalShortcut } from 'electron'
import { HOTKEY_LABELS } from '../shared/defaults'
import { findConflicts } from '../shared/hotkeys'
import type { HotkeyAction, Hotkeys } from '../shared/types'

/**
 * Re-registers all global shortcuts. Returns human-readable problems
 * (duplicates, or shortcuts another app already owns) for the Settings page.
 */
export function registerHotkeys(hotkeys: Hotkeys, onAction: (a: HotkeyAction) => void): string[] {
  globalShortcut.unregisterAll()
  const errors: string[] = []
  const conflicted = new Set<HotkeyAction>()
  for (const group of findConflicts(hotkeys)) {
    errors.push(`${group.map((a) => HOTKEY_LABELS[a]).join(' and ')} use the same shortcut.`)
    group.slice(1).forEach((a) => conflicted.add(a))
  }
  for (const [action, accel] of Object.entries(hotkeys) as [HotkeyAction, string][]) {
    if (!accel || conflicted.has(action)) continue
    try {
      if (!globalShortcut.register(accel, () => onAction(action))) {
        errors.push(`${accel} (${HOTKEY_LABELS[action]}) is already used by another app.`)
      }
    } catch {
      errors.push(`"${accel}" is not a valid shortcut (${HOTKEY_LABELS[action]}).`)
    }
  }
  return errors
}
