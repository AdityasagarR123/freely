/** All Gemini traffic goes through here. The API key never leaves the main process. */
import { GoogleGenAI } from '@google/genai'
import { PROMPTS } from '../shared/defaults'
import type { Attachment, ChatMessage, StreamEvent } from '../shared/types'
import {
  attachmentsToParts,
  buildContents,
  buildSystemInstruction,
  collectStream,
  friendlyError,
  NoKeyError,
} from './geminiRequest'
import { getApiKey, getSettings } from './store'

let client: { key: string; ai: GoogleGenAI } | null = null

/** Returns a client for the stored key, recreating it when the key changes. */
export function getClient(key = getApiKey()): GoogleGenAI {
  if (!key) throw new NoKeyError()
  if (client?.key !== key) client = { key, ai: new GoogleGenAI({ apiKey: key }) }
  return client.ai
}

const inflight = new Map<string, AbortController>()

/** Streams a chat reply; every event is tagged with `requestId` so the renderer can ignore stale streams. */
export async function streamChat(
  requestId: string,
  messages: ChatMessage[],
  emit: (e: StreamEvent) => void,
): Promise<void> {
  const controller = new AbortController()
  inflight.set(requestId, controller)
  try {
    const settings = getSettings()
    const stream = await getClient().models.generateContentStream({
      model: settings.textModel,
      contents: buildContents(messages),
      config: { systemInstruction: buildSystemInstruction(settings), abortSignal: controller.signal },
    })
    await collectStream(stream, (text) => {
      if (!controller.signal.aborted) emit({ requestId, type: 'chunk', text })
    })
    emit({ requestId, type: 'done' })
  } catch (err) {
    if (controller.signal.aborted) emit({ requestId, type: 'done' })
    else emit({ requestId, type: 'error', message: friendlyError(err) })
  } finally {
    inflight.delete(requestId)
  }
}

export function abortChat(requestId: string): void {
  inflight.get(requestId)?.abort()
}

/** One-shot request used for summaries and transcript helpers. Throws a friendly message on failure. */
export async function complete(prompt: string, attachments?: Attachment[]): Promise<string> {
  try {
    const settings = getSettings()
    const res = await getClient().models.generateContent({
      model: settings.textModel,
      contents: [{ role: 'user', parts: [...attachmentsToParts(attachments), { text: prompt }] }],
      config: { systemInstruction: buildSystemInstruction(settings) },
    })
    return res.text ?? ''
  } catch (err) {
    throw new Error(friendlyError(err), { cause: err })
  }
}

/** Makes the smallest possible request to check a key works. */
export async function testKey(key?: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await getClient(key?.trim() || getApiKey()).models.generateContent({
      model: getSettings().textModel,
      contents: 'Reply with the single word: ok',
      config: { maxOutputTokens: 16 },
    })
    return { ok: true, message: `Key works (model replied: "${(res.text ?? '').trim().slice(0, 20) || 'ok'}").` }
  } catch (err) {
    return { ok: false, message: friendlyError(err) }
  }
}

/** Fallback transcription for when the Live API is unavailable: one WAV chunk → text. */
export async function transcribeWav(wav: Buffer): Promise<string> {
  const res = await getClient().models.generateContent({
    model: getSettings().textModel,
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } }, { text: PROMPTS.transcribe }],
      },
    ],
  })
  return (res.text ?? '').trim()
}
