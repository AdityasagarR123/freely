import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChatSession, ChatSummary } from '../../shared/types'

export function HistoryPage({
  saveHistory,
  onOpen,
}: {
  saveHistory: boolean
  onOpen: (c: ChatSession) => void
}): React.JSX.Element {
  const [chats, setChats] = useState<ChatSummary[] | null>(null)
  const refresh = (): void => void window.freely.listChats().then(setChats)
  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="text-[12px] text-[var(--muted)]">
          {saveHistory ? 'Saved only on this computer.' : 'History saving is off (Settings).'}
        </span>
        <button
          className="btn danger"
          disabled={!chats?.length}
          onClick={() => {
            if (confirm('Delete all saved chats? This cannot be undone.')) void window.freely.clearChats().then(refresh)
          }}
        >
          Clear all
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {chats?.length === 0 && <div className="mt-10 text-center text-[var(--muted)]">No saved chats yet.</div>}
        {chats?.map((c) => (
          <div
            key={c.id}
            className="group flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-[var(--surface-hover)]"
          >
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => void window.freely.loadChat(c.id).then((full) => full && onOpen(full))}
            >
              <div className="truncate">{c.title}</div>
              <div className="text-[11px] text-[var(--muted)]">{new Date(c.updatedAt).toLocaleString()}</div>
            </button>
            <button
              className="icon-btn opacity-0 group-hover:opacity-100"
              title="Delete"
              onClick={() => void window.freely.deleteChat(c.id).then(refresh)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
