import { Download, Lightbulb, ListChecks, Mic, MicOff, Trash2, Wand2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PROMPTS } from '../../shared/defaults'
import { formatTranscript, type ListenState } from '../hooks/useListen'
import { ipcErrorMessage } from '../lib/util'

interface Props {
  listen: ListenState
  bothSources: boolean
  onWhatToSay: () => void
  /** Sends a prompt built from the transcript to the chat tab. */
  onAsk: (prompt: string) => void
}

export function TranscriptPage({ listen, bothSources, onWhatToSay, onAsk }: Props): React.JSX.Element {
  const bottom = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const { segments } = listen
  const labels = bothSources || new Set(segments.map((s) => s.speaker)).size > 1

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [segments])

  const full = (): string => formatTranscript(segments, labels)
  const recent = (): string => formatTranscript(segments, labels, 3 * 60_000)

  const save = async (): Promise<void> => {
    setSaving('Writing summary…')
    let summary: string
    try {
      summary = await window.freely.complete(PROMPTS.summarize(full()))
    } catch (err) {
      summary = `_Summary unavailable: ${ipcErrorMessage(err)}_`
    }
    const date = new Date().toLocaleString()
    const md = `# Transcript — ${date}\n\n## Summary\n\n${summary}\n\n## Transcript\n\n${segments
      .map(
        (s) =>
          `- **${new Date(s.at).toLocaleTimeString()}${labels ? ` · ${s.speaker === 'you' ? 'You' : 'Others'}` : ''}:** ${s.text.trim()}`,
      )
      .join('\n')}\n`
    const path = await window.freely.saveTranscript(md)
    setSaving(path ? `Saved to ${path}` : null)
    if (path) setTimeout(() => setSaving(null), 4000)
  }

  const empty = !segments.length
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button
            className={`btn ${listen.listening ? 'danger' : 'primary'}`}
            disabled={listen.starting}
            onClick={listen.toggle}
          >
            {listen.listening ? <MicOff size={14} /> : <Mic size={14} />}
            {listen.starting ? 'Starting…' : listen.listening ? 'Stop listening' : 'Listen'}
          </button>
          <div className="flex-1" />
          <button
            className="icon-btn"
            disabled={empty || !!saving}
            title="Save transcript + summary as Markdown"
            onClick={() => void save()}
          >
            <Download size={15} />
          </button>
          <button className="icon-btn" disabled={empty} title="Clear transcript" onClick={listen.clear}>
            <Trash2 size={15} />
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          <button
            className="btn"
            disabled={empty}
            onClick={onWhatToSay}
            title="Suggest replies from the last 3 minutes"
          >
            <Lightbulb size={14} /> What should I say?
          </button>
          <button className="btn" disabled={empty} onClick={() => onAsk(PROMPTS.summarize(full()))}>
            <ListChecks size={14} /> Summarize
          </button>
          <button className="btn" disabled={empty} onClick={() => onAsk(PROMPTS.explainThat(recent() || full()))}>
            <Wand2 size={14} /> Explain that
          </button>
        </div>
      </div>
      {(listen.notice || saving) && (
        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--muted)]">
          {saving ?? listen.notice}
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {empty ? (
          <div className="mt-10 text-center text-[var(--muted)]">
            {listen.listening
              ? 'Listening… speech will appear here.'
              : 'Press Listen to transcribe your mic and/or computer audio live.'}
          </div>
        ) : (
          segments.map((s) => (
            <div key={s.id} className="leading-relaxed">
              {labels && (
                <span
                  className={`mr-1.5 text-[11px] font-semibold uppercase tracking-wide ${s.speaker === 'you' ? 'text-[var(--accent)]' : 'text-emerald-400'}`}
                >
                  {s.speaker === 'you' ? 'You' : 'Others'}
                </span>
              )}
              {s.text.trim()}
            </div>
          ))
        )}
        <div ref={bottom} />
      </div>
      {listen.mode === 'chunked' && listen.listening && (
        <div className="px-3 pb-2 text-[11px] text-[var(--muted)]">Chunked mode: text appears every ~10 s.</div>
      )}
    </div>
  )
}
