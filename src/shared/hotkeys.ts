import type { HotkeyAction, Hotkeys } from './types'

const MODIFIER_ORDER = ['CommandOrControl', 'Control', 'Command', 'Alt', 'Shift', 'Super'] as const

const MODIFIER_ALIASES: Record<string, (typeof MODIFIER_ORDER)[number]> = {
  commandorcontrol: 'CommandOrControl',
  cmdorctrl: 'CommandOrControl',
  control: 'Control',
  ctrl: 'Control',
  command: 'Command',
  cmd: 'Command',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  super: 'Super',
  meta: 'Super',
}

/** Canonical form of an Electron accelerator so "shift+ctrl+a" and "Ctrl+Shift+A" compare equal. */
export function normalizeAccelerator(accel: string): string {
  const parts = accel
    .split(/\+(?!$)/) // keep a trailing "+" key (e.g. "Ctrl++")
    .map((p) => p.trim())
    .filter(Boolean)
  const mods = new Set<string>()
  let key = ''
  for (const p of parts) {
    const mod = MODIFIER_ALIASES[p.toLowerCase()]
    if (mod) mods.add(mod)
    else key = p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1).toLowerCase()
  }
  const ordered = MODIFIER_ORDER.filter((m) => mods.has(m))
  return [...ordered, key].filter(Boolean).join('+')
}

/** An accelerator needs at least one modifier and exactly one non-modifier key. */
export function isValidAccelerator(accel: string): boolean {
  const norm = normalizeAccelerator(accel)
  const parts = norm.split('+')
  const key = parts[parts.length - 1]
  return parts.length >= 2 && !!key && !(key in MODIFIER_ALIASES) && !MODIFIER_ORDER.includes(key as never)
}

/** Groups of actions that share the same accelerator. Empty bindings are ignored. */
export function findConflicts(hotkeys: Hotkeys): HotkeyAction[][] {
  const byAccel = new Map<string, HotkeyAction[]>()
  for (const [action, accel] of Object.entries(hotkeys) as [HotkeyAction, string][]) {
    if (!accel) continue
    const norm = normalizeAccelerator(accel)
    byAccel.set(norm, [...(byAccel.get(norm) ?? []), action])
  }
  return [...byAccel.values()].filter((group) => group.length > 1)
}

/** Converts a DOM keydown event into an Electron accelerator, or null while only modifiers are held. */
export function acceleratorFromEvent(e: {
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}): string | null {
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) return null
  const mods: string[] = []
  if (e.ctrlKey || e.metaKey) mods.push('CommandOrControl')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  let key: string
  if (e.code.startsWith('Key')) key = e.code.slice(3)
  else if (e.code.startsWith('Digit')) key = e.code.slice(5)
  else if (e.code.startsWith('Arrow')) key = e.code.slice(5)
  else if (/^F\d{1,2}$/.test(e.code)) key = e.code
  else {
    const named: Record<string, string> = {
      Enter: 'Enter',
      Space: 'Space',
      Backslash: '\\',
      Slash: '/',
      Period: '.',
      Comma: ',',
      Semicolon: ';',
      Quote: "'",
      BracketLeft: '[',
      BracketRight: ']',
      Minus: '-',
      Equal: '=',
      Backquote: '`',
      Tab: 'Tab',
      Backspace: 'Backspace',
      Delete: 'Delete',
      Home: 'Home',
      End: 'End',
      PageUp: 'PageUp',
      PageDown: 'PageDown',
      Escape: 'Escape',
    }
    key = named[e.code] ?? e.key
  }
  return [...mods, key].join('+')
}

/** Human-friendly label, e.g. "Ctrl + Shift + S" (or "⌘ ⇧ S" on macOS). */
export function prettyAccelerator(accel: string, platform: string): string {
  const mac = platform === 'darwin'
  return normalizeAccelerator(accel)
    .split('+')
    .map((p) => {
      if (p === 'CommandOrControl') return mac ? '⌘' : 'Ctrl'
      if (p === 'Shift') return mac ? '⇧' : 'Shift'
      if (p === 'Alt') return mac ? '⌥' : 'Alt'
      const arrows: Record<string, string> = { Up: '↑', Down: '↓', Left: '←', Right: '→' }
      return arrows[p] ?? p
    })
    .join(mac ? ' ' : ' + ')
}
