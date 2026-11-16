/**
 * Pure helpers that turn app state into Gemini requests and Gemini failures into
 * friendly messages. Kept free of Electron/SDK side effects so they are unit-testable.
 */
import type { Content, GenerateContentResponse, Part } from '@google/genai'
import { LENGTH_HINTS } from '../shared/defaults'
import { trimHistory } from '../shared/history'
import type { Attachment, ChatMessage, Settings } from '../shared/types'

/** Splits a data URL into the inlineData shape Gemini expects. */
export function dataUrlToPart(dataUrl: string): Part {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('Attachment is not a base64 data URL')
  return { inlineData: { mimeType: match[1], data: match[2] } }
}

export function attachmentsToParts(attachments: Attachment[] = []): Part[] {
  return attachments.map((a) => dataUrlToPart(a.dataUrl))
}

/** Full system instruction: the user's prompt plus response-length and language hints. */
export function buildSystemInstruction(
  settings: Pick<Settings, 'systemPrompt' | 'responseLength' | 'language'>,
): string {
  const lines = [settings.systemPrompt.trim()]
  const lengthHint = LENGTH_HINTS[settings.responseLength]
  if (lengthHint) lines.push(lengthHint)
  if (settings.language && settings.language !== 'auto') lines.push(`Always respond in ${settings.language}.`)
  return lines.filter(Boolean).join('\n\n')
}

/** Converts chat history into Gemini `contents`, images first within each turn. */
export function buildContents(messages: ChatMessage[]): Content[] {
  return trimHistory(messages).map((m) => ({
    role: m.role,
    parts: [...attachmentsToParts(m.attachments), ...(m.text.trim() ? [{ text: m.text }] : [])],
  }))
}

/** Text of one streamed chunk, ignoring "thought" parts. Throws if the prompt was blocked. */
export function chunkText(chunk: GenerateContentResponse): string {
  const block = chunk.promptFeedback?.blockReason
  if (block) throw new SafetyBlockError(String(block))
  const candidate = chunk.candidates?.[0]
  if (candidate?.finishReason && /SAFETY|PROHIBITED|BLOCKLIST|SPII/.test(String(candidate.finishReason))) {
    throw new SafetyBlockError(String(candidate.finishReason))
  }
  return (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
}

/** Accumulates a whole stream into one string (used by one-shot requests and tests). */
export async function collectStream(
  stream: AsyncIterable<GenerateContentResponse>,
  onText?: (t: string) => void,
): Promise<string> {
  let out = ''
  for await (const chunk of stream) {
    const t = chunkText(chunk)
    if (t) {
      out += t
      onText?.(t)
    }
  }
  return out
}

export class SafetyBlockError extends Error {
  constructor(reason: string) {
    super(`Blocked by safety filters (${reason})`)
    this.name = 'SafetyBlockError'
  }
}

export class NoKeyError extends Error {
  constructor() {
    super('No API key')
    this.name = 'NoKeyError'
  }
}

/** Maps any thrown value into a message that tells the user what to do next. */
export function friendlyError(err: unknown): string {
  if (err instanceof NoKeyError)
    return 'No Gemini API key yet. Open Settings and paste your key (it is free at aistudio.google.com/apikey).'
  if (err instanceof SafetyBlockError) return "Gemini's safety filters blocked this request. Try rephrasing it."
  const e = err as { status?: number; code?: number; message?: string; name?: string; cause?: { code?: string } }
  if (e?.name === 'AbortError') return 'Stopped.'
  const msg = String(e?.message ?? err ?? '')
  const status =
    e?.status ?? e?.code ?? Number(/"code"\s*:\s*(\d{3})/.exec(msg)?.[1] ?? /\b(4\d\d|5\d\d)\b/.exec(msg)?.[1])

  if (/API[_ ]KEY[_ ]INVALID|API key not valid|PERMISSION_DENIED.*key/i.test(msg) || status === 401) {
    return 'Your Gemini API key was rejected. Check it in Settings, or create a new one at aistudio.google.com/apikey.'
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg)) {
    const retry = /retry in ([\d.]+)s/i.exec(msg) ?? /"retryDelay"\s*:\s*"(\d+)s"/.exec(msg)
    const wait = retry ? ` Try again in about ${Math.ceil(Number(retry[1]))} s.` : ' Wait a minute and try again.'
    return `Gemini's free-tier rate limit was reached.${wait}`
  }
  if (status === 404 || /not found for API version|models\/.* is not found/i.test(msg)) {
    return 'That model name was not found. Check the model names in Settings.'
  }
  if (status === 403) return 'Gemini refused the request (403). Your key may not have access to this model.'
  if (/fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|network/i.test(msg) || e?.cause?.code) {
    return "Couldn't reach Gemini. Check your internet connection and try again."
  }
  if (typeof status === 'number' && status >= 500)
    return 'Gemini is having trouble right now (server error). Try again shortly.'
  return `Something went wrong: ${msg.slice(0, 300) || 'unknown error'}`
}
