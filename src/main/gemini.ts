/** All Gemini traffic goes through here. The API key never leaves the main process. */
import { GoogleGenAI, type GenerateContentParameters } from '@google/genai'
import { FALLBACK_TEXT_MODEL, FIRST_TOKEN_TIMEOUT_MS, LIVE_API_VERSION, PROMPTS } from '../shared/defaults'
import type { Attachment, ChatMessage, StreamEvent } from '../shared/types'
import {
  attachmentsToParts,
  buildContents,
  buildSystemInstruction,
  chunkText,
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

let liveClient: { key: string; ai: GoogleGenAI } | null = null

/**
 * Client for Live (realtime) sessions. The SDK's default API version (v1) has no Live endpoint
 * and every connection fails with a 404, so Live is pinned to LIVE_API_VERSION.
 */
export function getLiveClient(key = getApiKey()): GoogleGenAI {
  if (!key) throw new NoKeyError()
  if (liveClient?.key !== key) {
    liveClient = { key, ai: new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: LIVE_API_VERSION } }) }
  }
  return liveClient.ai
}

/** The configured text model, then the fallback (if different). */
function modelsToTry(): string[] {
  const primary = getSettings().textModel
  return primary === FALLBACK_TEXT_MODEL ? [primary] : [primary, FALLBACK_TEXT_MODEL]
}

class NoResponseError extends Error {
  constructor() {
    super("The model didn't respond in time. Pick a different text model in Settings.")
    this.name = 'NoResponseError'
  }
}

/** Errors worth retrying on another model: overload/server errors, per-model rate limits, unknown model. */
function isModelProblem(err: unknown): boolean {
  const e = err as { status?: number; message?: string }
  const status = e?.status ?? Number(/"code"\s*:\s*(\d{3})/.exec(String(e?.message ?? ''))?.[1])
  return status === 404 || status === 429 || (status >= 500 && status < 600)
}

/**
 * Runs `attempt` for each model in turn. A model that produces nothing within
 * FIRST_TOKEN_TIMEOUT_MS is abandoned (its request aborted) and the next one is tried.
 * `attempt` must call `firstToken()` as soon as the model starts answering.
 */
async function withModelFallback<T>(
  userSignal: AbortSignal | undefined,
  attempt: (model: string, signal: AbortSignal, firstToken: () => void) => Promise<T>,
): Promise<T> {
  const models = modelsToTry()
  for (let i = 0; i < models.length; i++) {
    const ctrl = new AbortController()
    const onUserAbort = (): void => ctrl.abort()
    userSignal?.addEventListener('abort', onUserAbort)
    let started = false
    let timedOut = false
    const timer = setTimeout(() => {
      if (!started) {
        timedOut = true
        ctrl.abort()
      }
    }, FIRST_TOKEN_TIMEOUT_MS)
    try {
      return await attempt(models[i], ctrl.signal, () => {
        started = true
        clearTimeout(timer)
      })
    } catch (err) {
      const last = i === models.length - 1
      if (userSignal?.aborted || started) throw err
      if (timedOut) {
        if (last) throw new NoResponseError()
      } else if (last || !isModelProblem(err)) {
        throw err
      }
      // This model failed before producing output: fall through to the next one.
    } finally {
      clearTimeout(timer)
      userSignal?.removeEventListener('abort', onUserAbort)
    }
  }
  throw new NoResponseError()
}

/** Non-streamed request with model fallback; returns the reply text. */
async function generateText(params: Omit<GenerateContentParameters, 'model'>, key?: string): Promise<string> {
  const ai = getClient(key)
  return withModelFallback(undefined, async (model, signal, firstToken) => {
    const res = await ai.models.generateContent({ ...params, model, config: { ...params.config, abortSignal: signal } })
    firstToken()
    return res.text ?? ''
  })
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
    const ai = getClient()
    await withModelFallback(controller.signal, async (model, signal, firstToken) => {
      const stream = await ai.models.generateContentStream({
        model,
        contents: buildContents(messages),
        config: { systemInstruction: buildSystemInstruction(settings), abortSignal: signal },
      })
      for await (const chunk of stream) {
        const text = chunkText(chunk)
        if (!text) continue
        firstToken()
        if (!controller.signal.aborted) emit({ requestId, type: 'chunk', text })
      }
    })
    emit({ requestId, type: 'done' })
  } catch (err) {
    if (controller.signal.aborted) emit({ requestId, type: 'done' })
    else emit({ requestId, type: 'error', message: err instanceof NoResponseError ? err.message : friendlyError(err) })
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
    return await generateText({
      contents: [{ role: 'user', parts: [...attachmentsToParts(attachments), { text: prompt }] }],
      config: { systemInstruction: buildSystemInstruction(getSettings()) },
    })
  } catch (err) {
    throw new Error(err instanceof NoResponseError ? err.message : friendlyError(err), { cause: err })
  }
}

/** Makes a tiny request to check a key works. */
export async function testKey(key?: string): Promise<{ ok: boolean; message: string }> {
  try {
    const text = await generateText({ contents: 'Reply with the single word: ok' }, key?.trim() || undefined)
    return { ok: true, message: `Key works (model replied: "${text.trim().slice(0, 20) || 'ok'}").` }
  } catch (err) {
    return { ok: false, message: err instanceof NoResponseError ? err.message : friendlyError(err) }
  }
}

/** Fallback transcription for when the Live API is unavailable: one WAV chunk → text. */
export async function transcribeWav(wav: Buffer): Promise<string> {
  const text = await generateText({
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } }, { text: PROMPTS.transcribe }],
      },
    ],
  })
  return text.trim()
}
