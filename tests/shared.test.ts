import { describe, expect, it } from 'vitest'
import { pcmLevel, pcmToWav } from '../src/main/audio/wav'
import { DEFAULT_HOTKEYS, DEFAULT_SETTINGS } from '../src/shared/defaults'
import { chatTitle, trimHistory } from '../src/shared/history'
import { acceleratorFromEvent, findConflicts, isValidAccelerator, normalizeAccelerator } from '../src/shared/hotkeys'
import { migrateSettings } from '../src/shared/settings'
import type { ChatMessage } from '../src/shared/types'

const msg = (role: 'user' | 'model', text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: Math.random().toString(36),
  role,
  text,
  ...extra,
})

describe('trimHistory', () => {
  it('keeps the newest messages within the budget and starts on a user turn', () => {
    const history = [
      msg('user', 'a'.repeat(50)),
      msg('model', 'b'.repeat(50)),
      msg('user', 'c'.repeat(50)),
      msg('model', 'd'.repeat(50)),
      msg('user', 'e'),
    ]
    const out = trimHistory(history, { maxChars: 120, maxImages: 3 })
    expect(out.map((m) => m.text[0])).toEqual(['c', 'd', 'e'])
  })

  it('always keeps the last message even if it alone exceeds the budget', () => {
    expect(trimHistory([msg('user', 'x'.repeat(500))], { maxChars: 10, maxImages: 3 })).toHaveLength(1)
  })

  it('drops errors and empty replies', () => {
    const out = trimHistory([
      msg('user', 'hi'),
      msg('model', 'oops', { error: true }),
      msg('model', ''),
      msg('user', 'again'),
    ])
    expect(out.map((m) => m.text)).toEqual(['hi', 'again'])
  })

  it('keeps only the newest images', () => {
    const img = (n: number): { dataUrl: string } => ({ dataUrl: `data:image/png;base64,${n}` })
    const out = trimHistory(
      [
        msg('user', '1', { attachments: [img(1), img(2)] }),
        msg('model', 'ok'),
        msg('user', '2', { attachments: [img(3), img(4)] }),
      ],
      { maxChars: 1000, maxImages: 3 },
    )
    expect(out[0].attachments).toEqual([img(2)])
    expect(out[2].attachments).toEqual([img(3), img(4)])
  })

  it('titles chats from the first user message', () => {
    expect(chatTitle([msg('user', '  hello   world ')])).toBe('hello world')
    expect(chatTitle([msg('user', '', { attachments: [{ dataUrl: 'x' }] })])).toBe('Screenshot')
    expect(chatTitle([msg('user', 'x'.repeat(100))])).toHaveLength(58)
  })
})

describe('migrateSettings', () => {
  it('returns defaults for garbage', () => {
    expect(migrateSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(migrateSettings('nope')).toEqual(DEFAULT_SETTINGS)
  })

  it('migrates v1 fields', () => {
    const s = migrateSettings({ model: 'old-model', opacity: 70, hotkeys: { newChat: 'Alt+N' } })
    expect(s.textModel).toBe('old-model')
    expect(s.opacity).toBeCloseTo(0.7)
    expect(s.hotkeys.newChat).toBe('Alt+N')
    expect(s.hotkeys.toggleOverlay).toBe(DEFAULT_HOTKEYS.toggleOverlay)
    expect(s.version).toBe(DEFAULT_SETTINGS.version)
  })

  it('rejects wrong types and invalid enums, and clamps opacity', () => {
    const s = migrateSettings({
      version: 2,
      theme: 'neon',
      saveHistory: 'yes',
      opacity: 0.1,
      textModel: '  ',
      unknownKey: 1,
    })
    expect(s.theme).toBe('dark')
    expect(s.saveHistory).toBe(true)
    expect(s.opacity).toBe(0.4)
    expect(s.textModel).toBe(DEFAULT_SETTINGS.textModel)
    expect(s).not.toHaveProperty('unknownKey')
  })
})

describe('hotkeys', () => {
  it('normalizes aliases and modifier order', () => {
    expect(normalizeAccelerator('shift+cmdorctrl+s')).toBe('CommandOrControl+Shift+S')
    expect(normalizeAccelerator('Ctrl+Alt+Up')).toBe('Control+Alt+Up')
  })

  it('has no conflicts in the defaults', () => {
    expect(findConflicts(DEFAULT_HOTKEYS)).toEqual([])
  })

  it('detects conflicts regardless of spelling and ignores empty bindings', () => {
    const conflicts = findConflicts({
      ...DEFAULT_HOTKEYS,
      newChat: 'shift+CommandOrControl+s',
      moveUp: '',
      moveDown: '',
    })
    expect(conflicts).toEqual([['regionShot', 'newChat']])
  })

  it('validates accelerators', () => {
    expect(isValidAccelerator('CommandOrControl+K')).toBe(true)
    expect(isValidAccelerator('K')).toBe(false)
    expect(isValidAccelerator('Ctrl+Shift')).toBe(false)
  })

  it('builds accelerators from key events', () => {
    const base = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }
    expect(acceleratorFromEvent({ ...base, key: 'S', code: 'KeyS' })).toBe('CommandOrControl+Shift+S')
    expect(acceleratorFromEvent({ ...base, key: '\\', code: 'Backslash' })).toBe('CommandOrControl+Shift+\\')
    expect(acceleratorFromEvent({ ...base, key: 'Shift', code: 'ShiftLeft' })).toBeNull()
  })
})

describe('wav', () => {
  it('writes a valid 16 kHz mono header', () => {
    const wav = pcmToWav(Buffer.alloc(3200), 16000)
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.readUInt32LE(24)).toBe(16000)
    expect(wav.readUInt32LE(40)).toBe(3200)
    expect(wav.length).toBe(3244)
  })

  it('measures level', () => {
    expect(pcmLevel(Buffer.alloc(100))).toBe(0)
    const loud = Buffer.alloc(4)
    loud.writeInt16LE(32767, 0)
    loud.writeInt16LE(-32768, 2)
    expect(pcmLevel(loud)).toBeGreaterThan(0.99)
  })
})
