import type { ChatMessage } from './types'

export interface TrimOptions {
  /** Approximate character budget for all message text. */
  maxChars: number
  /** Only the newest N images are sent; older ones are dropped to save bandwidth. */
  maxImages: number
}

export const DEFAULT_TRIM: TrimOptions = { maxChars: 120_000, maxImages: 3 }

/**
 * Prepares chat history for a request:
 * - drops error placeholders and empty model turns,
 * - keeps the newest messages that fit in `maxChars` (always keeping the last one),
 * - keeps only the newest `maxImages` images,
 * - guarantees the history starts with a user turn (Gemini rejects a leading model turn).
 */
export function trimHistory(messages: ChatMessage[], opts: TrimOptions = DEFAULT_TRIM): ChatMessage[] {
  const clean = messages.filter((m) => !m.error && (m.text.trim() || m.attachments?.length))
  const kept: ChatMessage[] = []
  let chars = 0
  for (let i = clean.length - 1; i >= 0; i--) {
    const m = clean[i]
    chars += m.text.length
    if (kept.length > 0 && chars > opts.maxChars) break
    kept.unshift(m)
  }
  while (kept.length > 1 && kept[0].role !== 'user') kept.shift()

  let images = 0
  return kept
    .slice()
    .reverse()
    .map((m) => {
      if (!m.attachments?.length) return m
      const room = Math.max(0, opts.maxImages - images)
      const attachments = room === 0 ? [] : m.attachments.slice(-room)
      images += attachments.length
      return { ...m, attachments }
    })
    .reverse()
}

/** A short title for the history list, taken from the first user message. */
export function chatTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user')
  const text = first?.text.trim().replace(/\s+/g, ' ') || (first?.attachments?.length ? 'Screenshot' : 'New chat')
  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}
