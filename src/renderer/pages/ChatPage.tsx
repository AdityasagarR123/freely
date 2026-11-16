import { useEffect, useRef } from 'react'
import { prettyAccelerator } from '../../shared/hotkeys'
import type { Hotkeys } from '../../shared/types'
import { Composer } from '../components/Composer'
import { Message } from '../components/Message'
import type { ChatState } from '../hooks/useChat'

interface Props {
  chat: ChatState
  hotkeys: Hotkeys
  onScreenshot: () => void
  onRegion: () => void
  onQuickPrompt: (prompt: string) => void
}

export function ChatPage({ chat, hotkeys, onScreenshot, onRegion, onQuickPrompt }: Props): React.JSX.Element {
  const scroller = useRef<HTMLDivElement>(null)
  const { messages } = chat.chat
  const last = messages[messages.length - 1]

  // Follow the stream unless the user scrolled up to read.
  useEffect(() => {
    const el = scroller.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight
  }, [messages.length, last?.text])

  const key = (a: keyof Hotkeys): string => prettyAccelerator(hotkeys[a], window.freely.platform)

  return (
    <>
      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3.5 py-3">
        {messages.length === 0 ? (
          <div className="mt-8 space-y-2 text-center text-[var(--muted)]">
            <div className="text-[15px] text-[var(--text)]">How can I help?</div>
            <div className="text-[12px] leading-6">
              <kbd className="font-mono">{key('screenshotAsk')}</kbd> ask about your screen
              <br />
              <kbd className="font-mono">{key('regionShot')}</kbd> ask about a region
              <br />
              <kbd className="font-mono">{key('toggleListen')}</kbd> start listening
            </div>
          </div>
        ) : (
          messages.map((m) => <Message key={m.id} message={m} streaming={chat.streaming && m === last} />)
        )}
      </div>
      <Composer
        draft={chat.draft}
        setDraft={chat.setDraft}
        pending={chat.pending}
        setPending={chat.setPending}
        streaming={chat.streaming}
        onSend={() => {
          chat.send(chat.draft, chat.pending)
          chat.setDraft('')
          chat.setPending(() => [])
        }}
        onStop={chat.stop}
        onScreenshot={onScreenshot}
        onRegion={onRegion}
        onQuickPrompt={onQuickPrompt}
      />
    </>
  )
}
