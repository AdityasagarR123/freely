import { useCallback, useEffect, useRef, useState } from 'react'
import { chatTitle } from '../../shared/history'
import type { Attachment, ChatMessage, ChatSession } from '../../shared/types'
import { uid } from '../lib/util'

const emptyChat = (): ChatSession => ({
  id: uid(),
  title: 'New chat',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [],
})

export interface ChatState {
  chat: ChatSession
  streaming: boolean
  draft: string
  setDraft: (v: string) => void
  pending: Attachment[]
  setPending: (fn: (a: Attachment[]) => Attachment[]) => void
  send: (text: string, attachments?: Attachment[]) => void
  stop: () => void
  reset: () => void
  open: (chat: ChatSession) => void
}

/** Conversation state plus streaming from the main process. */
export function useChat(): ChatState {
  const [chat, setChat] = useState<ChatSession>(emptyChat)
  const chatRef = useRef(chat)
  useEffect(() => {
    chatRef.current = chat
  }, [chat])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<Attachment[]>([])
  const active = useRef<{ requestId: string; messageId: string } | null>(null)
  const [streaming, setStreaming] = useState(false)
  // Saving is triggered once per finished reply, not on every chunk.
  const [saveTick, setSaveTick] = useState(0)

  const patchMessage = useCallback((messageId: string, fn: (m: ChatMessage) => ChatMessage) => {
    setChat((c) => ({ ...c, messages: c.messages.map((m) => (m.id === messageId ? fn(m) : m)) }))
  }, [])

  useEffect(
    () =>
      window.freely.onStream((e) => {
        const cur = active.current
        if (!cur || e.requestId !== cur.requestId) return
        if (e.type === 'chunk') {
          patchMessage(cur.messageId, (m) => ({ ...m, text: m.text + e.text }))
          return
        }
        if (e.type === 'error') patchMessage(cur.messageId, (m) => ({ ...m, text: e.message, error: true }))
        active.current = null
        setStreaming(false)
        setSaveTick((t) => t + 1)
      }),
    [patchMessage],
  )

  useEffect(() => {
    if (saveTick && chat.messages.length) void window.freely.saveChat(chat)
    // Only re-run when a reply finishes; `chat` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTick])

  const send = useCallback((text: string, attachments: Attachment[] = []) => {
    if (active.current || (!text.trim() && !attachments.length)) return
    const user: ChatMessage = { id: uid(), role: 'user', text: text.trim(), attachments }
    const reply: ChatMessage = { id: uid(), role: 'model', text: '' }
    const requestId = uid()
    active.current = { requestId, messageId: reply.id }
    setStreaming(true)
    const messages = [...chatRef.current.messages, user]
    void window.freely.chatSend(requestId, messages)
    setChat((c) => ({ ...c, title: chatTitle(messages), updatedAt: Date.now(), messages: [...messages, reply] }))
  }, [])

  const stop = useCallback(() => {
    if (active.current) void window.freely.chatAbort(active.current.requestId)
  }, [])

  const reset = useCallback(() => {
    stop()
    active.current = null
    setStreaming(false)
    setChat(emptyChat())
    setDraft('')
    setPending(() => [])
  }, [stop])

  const open = useCallback(
    (c: ChatSession) => {
      reset()
      setChat(c)
    },
    [reset],
  )

  return { chat, streaming, draft, setDraft, pending, setPending, send, stop, reset, open }
}
