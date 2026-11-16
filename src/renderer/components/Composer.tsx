import { ArrowUp, Camera, Scan, Square, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { QUICK_PROMPTS } from '../../shared/defaults'
import type { Attachment } from '../../shared/types'
import { imageFileToAttachment } from '../lib/util'

interface Props {
  draft: string
  setDraft: (v: string) => void
  pending: Attachment[]
  setPending: (fn: (a: Attachment[]) => Attachment[]) => void
  streaming: boolean
  onSend: () => void
  onStop: () => void
  onScreenshot: () => void
  onRegion: () => void
  onQuickPrompt: (prompt: string) => void
}

export function Composer(p: Props): React.JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-grow up to ~8 lines.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 170)}px`
  }, [p.draft])

  useEffect(() => ref.current?.focus(), [])

  const onPaste = async (e: React.ClipboardEvent): Promise<void> => {
    const files = [...e.clipboardData.items].filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile())
    if (!files.length) return
    e.preventDefault()
    const atts = await Promise.all(files.filter((f): f is File => !!f).map(imageFileToAttachment))
    p.setPending((a) => [...a, ...atts])
  }

  return (
    <div className="border-t border-[var(--border)] p-2.5">
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q.label}
            className="btn shrink-0 rounded-full! px-2.5! py-1! text-[11.5px]!"
            disabled={p.streaming}
            onClick={() => p.onQuickPrompt(q.prompt)}
          >
            {q.label}
          </button>
        ))}
      </div>
      {p.pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {p.pending.map((a, i) => (
            <div key={i} className="relative">
              <img src={a.dataUrl} className="h-14 rounded-md border border-[var(--border)]" alt="Attachment preview" />
              <button
                className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/80 text-white"
                title="Remove"
                onClick={() => p.setPending((list) => list.filter((_, j) => j !== i))}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 focus-within:border-[var(--accent)]">
        <button className="icon-btn shrink-0" title="Attach screenshot" onClick={p.onScreenshot}>
          <Camera size={16} />
        </button>
        <button className="icon-btn shrink-0" title="Attach a region of the screen" onClick={p.onRegion}>
          <Scan size={16} />
        </button>
        <textarea
          ref={ref}
          rows={1}
          value={p.draft}
          placeholder="Ask anything… (paste images with Ctrl/Cmd+V)"
          className="max-h-[170px] min-h-7 flex-1 resize-none bg-transparent px-1 py-1 leading-5 outline-none placeholder:text-[var(--muted)]"
          onChange={(e) => p.setDraft(e.target.value)}
          onPaste={(e) => void onPaste(e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              p.onSend()
            }
          }}
        />
        {p.streaming ? (
          <button className="icon-btn active shrink-0" title="Stop" onClick={p.onStop}>
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[#0b0d12] disabled:opacity-40"
            title="Send (Enter)"
            disabled={!p.draft.trim() && !p.pending.length}
            onClick={p.onSend}
          >
            <ArrowUp size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
