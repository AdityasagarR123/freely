/**
 * Live transcription. Each audio source ("you" = mic, "others" = system audio) gets its own
 * Gemini Live session so the transcript can be labelled by speaker. If a Live session can't be
 * opened, that source falls back to sending ~10 s WAV chunks to the regular model.
 */
import { Modality, type LiveServerMessage, type Session } from '@google/genai'
import { AUDIO_SAMPLE_RATE, LIVE_AUDIO_MIME, PROMPTS } from '../../shared/defaults'
import type { ListenEvent, Speaker, TranscriptSegment } from '../../shared/types'
import { friendlyError } from '../geminiRequest'
import { getClient, transcribeWav } from '../gemini'
import { getSettings } from '../store'
import { pcmLevel, pcmToWav } from './wav'

const CHUNK_MS = 10_000
const SEGMENT_GAP_MS = 2_500
const SILENCE_LEVEL = 0.008

interface Source {
  speaker: Speaker
  session: Session | null
  buffer: Buffer[]
  timer: NodeJS.Timeout | null
  current: TranscriptSegment | null
  lastAt: number
}

let sources: Source[] = []
let emit: (e: ListenEvent) => void = () => {}
let active = false
let segmentCounter = 0

/** Appends text to the speaker's open segment, or starts a new one after a pause. */
function addText(src: Source, text: string): void {
  if (!text.trim()) return
  const now = Date.now()
  const continues = src.current && now - src.lastAt < SEGMENT_GAP_MS && src.current.text.length < 400
  if (continues && src.current) {
    src.current = { ...src.current, text: src.current.text + text }
  } else {
    src.current = { id: `seg-${now}-${segmentCounter++}`, speaker: src.speaker, text: text.trimStart(), at: now }
  }
  src.lastAt = now
  emit({ type: 'segment', segment: src.current })
}

async function openLive(src: Source): Promise<boolean> {
  let closedEarly = false
  // Set only once the session is confirmed healthy; reconnects are attempted only for those.
  let live: Session | null = null
  try {
    const session = await getClient().live.connect({
      model: getSettings().liveModel,
      config: {
        // The Live API needs a response modality; we never play the audio, we only read the transcription.
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        systemInstruction: PROMPTS.liveInstruction,
      },
      callbacks: {
        onmessage: (m: LiveServerMessage) => {
          const text = m.serverContent?.inputTranscription?.text
          if (text) addText(src, text)
        },
        onerror: () => {},
        onclose: () => {
          closedEarly = true
          if (!live || src.session !== live) return
          src.session = null
          // Live sessions have a time limit: reconnect, or fall back to chunks if that fails.
          if (active && sources.includes(src)) {
            void openLive(src).then((ok) => {
              if (!ok && active) startChunked(src)
            })
          }
        },
      },
    })
    // A bad model name is reported by the server closing the socket right after it opens.
    await new Promise((r) => setTimeout(r, 1200))
    if (closedEarly) return false
    live = session
    src.session = session
    return true
  } catch {
    return false
  }
}

function startChunked(src: Source): void {
  if (src.timer) return
  src.timer = setInterval(() => {
    const pcm = Buffer.concat(src.buffer)
    src.buffer = []
    if (pcm.length < AUDIO_SAMPLE_RATE || pcmLevel(pcm) < SILENCE_LEVEL) return
    transcribeWav(pcmToWav(pcm, AUDIO_SAMPLE_RATE))
      .then((text) => {
        src.current = null // each chunk is its own segment
        if (text) addText(src, text)
      })
      .catch((err) => emit({ type: 'status', listening: active, mode: 'chunked', message: friendlyError(err) }))
  }, CHUNK_MS)
}

export async function startListening(
  speakers: Speaker[],
  onEvent: (e: ListenEvent) => void,
): Promise<'live' | 'chunked'> {
  stopListening()
  emit = onEvent
  active = true
  sources = speakers.map((speaker) => ({ speaker, session: null, buffer: [], timer: null, current: null, lastAt: 0 }))
  const results = await Promise.all(sources.map((s) => openLive(s)))
  sources.forEach((s, i) => {
    if (!results[i]) startChunked(s)
  })
  const mode = results.every(Boolean) ? 'live' : 'chunked'
  emit({
    type: 'status',
    listening: true,
    mode,
    message: mode === 'chunked' ? 'Live API unavailable — transcribing in 10-second chunks instead.' : undefined,
  })
  return mode
}

export function pushAudio(speaker: Speaker, pcm: ArrayBuffer): void {
  if (!active) return
  const src = sources.find((s) => s.speaker === speaker)
  if (!src) return
  const buf = Buffer.from(pcm)
  if (src.session) {
    src.session.sendRealtimeInput({ audio: { data: buf.toString('base64'), mimeType: LIVE_AUDIO_MIME } })
  } else {
    src.buffer.push(buf)
  }
}

export function stopListening(): void {
  if (!active) return
  active = false
  for (const s of sources) {
    if (s.timer) clearInterval(s.timer)
    const session = s.session
    s.session = null
    session?.close()
  }
  sources = []
  emit({ type: 'status', listening: false })
}
