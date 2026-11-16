/**
 * Captures microphone and/or system audio, converts it to 16 kHz PCM in an AudioWorklet,
 * and streams it to the main process for transcription. `listening` drives the red indicator,
 * and it is set before any audio is captured and cleared only after all capture has stopped.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AUDIO_SAMPLE_RATE } from '../../shared/defaults'
import type { Settings, Speaker, TranscriptSegment } from '../../shared/types'

interface Capture {
  ctx: AudioContext
  streams: MediaStream[]
}

const MAC_LOOPBACK_HELP =
  "System audio isn't available on this Mac. Install a virtual audio device such as BlackHole, route your output through it, then pick it as the microphone in Settings and use the Microphone source."

async function systemAudioStream(): Promise<MediaStream> {
  // The main process answers this with the screen + OS loopback audio; we only keep the audio.
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  stream.getVideoTracks().forEach((t) => {
    t.stop()
    stream.removeTrack(t)
  })
  if (!stream.getAudioTracks().length) throw new Error('no-loopback')
  return stream
}

export interface ListenState {
  listening: boolean
  starting: boolean
  mode: 'live' | 'chunked' | null
  notice: string | null
  segments: TranscriptSegment[]
  start: () => Promise<void>
  stop: () => Promise<void>
  toggle: () => void
  clear: () => void
}

export function useListen(settings: Settings | undefined): ListenState {
  const [listening, setListening] = useState(false)
  const [starting, setStarting] = useState(false)
  const [mode, setMode] = useState<'live' | 'chunked' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const capture = useRef<Capture | null>(null)

  useEffect(
    () =>
      window.freely.onListen((e) => {
        if (e.type === 'segment') {
          setSegments((list) => {
            const i = list.findIndex((s) => s.id === e.segment.id)
            if (i === -1) return [...list, e.segment]
            const next = list.slice()
            next[i] = e.segment
            return next
          })
        } else {
          if (e.mode) setMode(e.mode)
          if (e.message) setNotice(e.message)
        }
      }),
    [],
  )

  const release = useCallback(async () => {
    const cap = capture.current
    capture.current = null
    cap?.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    await cap?.ctx.close().catch(() => {})
  }, [])

  const stop = useCallback(async () => {
    await release()
    await window.freely.listenStop()
    setListening(false)
    setMode(null)
  }, [release])

  const start = useCallback(async () => {
    if (!settings || capture.current || starting) return
    setStarting(true)
    setNotice(null)
    setListening(true) // indicator is on before any capture begins
    const sources: Speaker[] =
      settings.audioSource === 'both' ? ['you', 'others'] : settings.audioSource === 'mic' ? ['you'] : ['others']
    const streams: { speaker: Speaker; stream: MediaStream }[] = []
    try {
      if (sources.includes('you')) {
        await window.freely.requestMicAccess()
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: settings.micDeviceId ? { exact: settings.micDeviceId } : undefined,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        })
        streams.push({ speaker: 'you', stream })
      }
      if (sources.includes('others')) {
        try {
          streams.push({ speaker: 'others', stream: await systemAudioStream() })
        } catch {
          if (window.freely.platform === 'darwin') setNotice(MAC_LOOPBACK_HELP)
          else setNotice("Couldn't capture system audio, so only the microphone is being transcribed.")
          if (!streams.length)
            throw new Error(window.freely.platform === 'darwin' ? MAC_LOOPBACK_HELP : 'System audio capture failed.')
        }
      }

      // Chromium resamples to the context rate, so the worklet receives 16 kHz audio directly.
      const ctx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE })
      capture.current = { ctx, streams: streams.map((s) => s.stream) }
      await ctx.audioWorklet.addModule('./pcm-worklet.js')
      const res = await window.freely.listenStart(streams.map((s) => s.speaker))
      setMode(res.mode)
      for (const { speaker, stream } of streams) {
        const node = new AudioWorkletNode(ctx, 'pcm-worklet')
        node.port.onmessage = (ev: MessageEvent<ArrayBuffer>) => window.freely.sendAudio(speaker, ev.data)
        ctx.createMediaStreamSource(stream).connect(node)
        // The worklet produces no audible output; connecting keeps the graph pulling audio.
        node.connect(ctx.destination)
      }
    } catch (err) {
      streams.forEach((s) => s.stream.getTracks().forEach((t) => t.stop()))
      await stop()
      const msg = err instanceof Error ? err.message : String(err)
      setNotice(
        /Permission|NotAllowed/i.test(msg)
          ? 'Microphone access was denied. Allow it in your OS privacy settings.'
          : msg,
      )
    } finally {
      setStarting(false)
    }
  }, [settings, starting, stop])

  const toggle = useCallback(() => {
    if (listening) void stop()
    else void start()
  }, [listening, start, stop])

  // Never leave capture running if the component goes away.
  useEffect(() => () => void release(), [release])

  return { listening, starting, mode, notice, segments, start, stop, toggle, clear: () => setSegments([]) }
}

/** Formats transcript lines, optionally only the last `withinMs`. */
export function formatTranscript(segments: TranscriptSegment[], labels: boolean, withinMs?: number): string {
  const since = withinMs ? Date.now() - withinMs : 0
  return segments
    .filter((s) => s.at >= since)
    .map((s) => (labels ? `${s.speaker === 'you' ? 'You' : 'Others'}: ${s.text.trim()}` : s.text.trim()))
    .join('\n')
}
