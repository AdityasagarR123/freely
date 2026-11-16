import {
  AudioLines,
  EyeOff,
  History,
  MessageSquare,
  Minus,
  MousePointerClick,
  Plus,
  Settings as SettingsIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_SCREEN_PROMPT, PROMPTS } from '../shared/defaults'
import type { Attachment, HotkeyAction } from '../shared/types'
import { useChat } from './hooks/useChat'
import { formatTranscript, useListen } from './hooks/useListen'
import { useSettings } from './hooks/useSettings'
import { ChatPage } from './pages/ChatPage'
import { HistoryPage } from './pages/HistoryPage'
import { Onboarding, ScreenPermissionGuide } from './pages/Onboarding'
import { SettingsPage } from './pages/SettingsPage'
import { TranscriptPage } from './pages/TranscriptPage'

type Tab = 'chat' | 'transcript' | 'history' | 'settings'

const TABS: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'transcript', label: 'Transcript', icon: AudioLines },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export function App(): React.JSX.Element | null {
  const { state, update, setKey } = useSettings()
  const chat = useChat()
  const listen = useListen(state?.settings)
  const [tab, setTab] = useState<Tab>('chat')
  const [clickThrough, setClickThrough] = useState(false)
  const [captureProblem, setCaptureProblem] = useState<'mac-permission' | 'failed' | null>(null)

  useEffect(() => window.freely.onClickThrough(setClickThrough), [])

  /** Takes a screenshot, or explains why it couldn't. */
  const capture = useCallback(async (region: boolean): Promise<Attachment | null> => {
    const shot = region ? await window.freely.captureRegion() : await window.freely.captureScreen()
    if (shot) {
      setCaptureProblem(null)
      return shot
    }
    if (region) return null // null also means the user pressed Esc
    const perm = await window.freely.screenPermission()
    setCaptureProblem(perm.platform === 'darwin' && perm.status !== 'granted' ? 'mac-permission' : 'failed')
    setTab('chat')
    return null
  }, [])

  const attach = useCallback(
    async (region: boolean) => {
      const shot = await capture(region)
      if (shot) chat.setPending((a) => [...a, shot])
    },
    [capture, chat],
  )

  /** Sends draft + pending attachments (+ `extra`), then clears the composer. */
  const sendNow = useCallback(
    (text: string, extra: Attachment[] = []) => {
      setTab('chat')
      chat.send(text, [...chat.pending, ...extra])
      chat.setDraft('')
      chat.setPending(() => [])
    },
    [chat],
  )

  const screenshotAsk = useCallback(async () => {
    if (chat.streaming) return
    const shot = await capture(false)
    if (shot) sendNow(chat.draft.trim() || DEFAULT_SCREEN_PROMPT, [shot])
  }, [capture, chat.draft, chat.streaming, sendNow])

  /** Quick prompts work on the draft text / attachments, or on a fresh screenshot if there's nothing. */
  const quickPrompt = useCallback(
    async (prompt: string) => {
      const draft = chat.draft.trim()
      const text = draft ? `${prompt}\n\n${draft}` : prompt
      if (draft || chat.pending.length) return sendNow(text)
      const shot = await capture(false)
      if (shot) sendNow(text, [shot])
    },
    [capture, chat.draft, chat.pending.length, sendNow],
  )

  const bothSources = state?.settings.audioSource === 'both'

  const whatToSay = useCallback(async () => {
    const transcript = formatTranscript(listen.segments, true, 3 * 60_000)
    if (!transcript) {
      setTab('transcript')
      return
    }
    const shot = state?.settings.screenshotWithSuggestions ? await capture(false) : null
    sendNow(PROMPTS.whatToSay(transcript), shot ? [shot] : [])
  }, [capture, listen.segments, sendNow, state?.settings.screenshotWithSuggestions])

  // Hotkeys arrive from the main process; a ref keeps the subscription stable.
  const handlers = useRef<Partial<Record<HotkeyAction | 'openSettings', () => void>>>({})
  useEffect(() => {
    handlers.current = {
      screenshotAsk: () => void screenshotAsk(),
      regionShot: () => void attach(true),
      toggleListen: listen.toggle,
      whatToSay: () => void whatToSay(),
      newChat: () => {
        chat.reset()
        setTab('chat')
      },
      openSettings: () => setTab('settings'),
    }
  })
  useEffect(() => window.freely.onHotkey((a) => handlers.current[a]?.()), [])

  if (!state) return null

  return (
    <div className="glass flex h-full flex-col overflow-hidden">
      <header className="drag flex h-10 shrink-0 items-center gap-1 border-b border-[var(--border)] pl-3 pr-1.5">
        <span className="mr-1 text-[13px] font-semibold tracking-tight">
          Freely<span className="text-[var(--accent)]">.</span>
        </span>
        {listen.listening && (
          <button
            className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400"
            onClick={() => setTab('transcript')}
            title="Audio is being captured"
          >
            <span className="listening-dot">●</span> Listening
          </button>
        )}
        {clickThrough && (
          <span
            className="flex items-center gap-1 rounded-full bg-[var(--accent-tint)] px-2 py-0.5 text-[11px] text-[var(--accent)]"
            title="Clicks pass through. Press the click-through hotkey to turn off."
          >
            <MousePointerClick size={11} /> Click-through
          </span>
        )}
        {state.settings.hideFromCapture && (
          <span className="text-[var(--muted)]" title="Hidden from screen capture">
            <EyeOff size={12} />
          </span>
        )}
        <div className="flex-1" />
        {state.settings.onboarded &&
          TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`icon-btn ${tab === id ? 'active' : ''}`}
              title={label}
              onClick={() => setTab(id)}
            >
              <Icon size={15} />
            </button>
          ))}
        <button
          className="icon-btn"
          title="New chat"
          onClick={() => {
            chat.reset()
            setTab('chat')
          }}
        >
          <Plus size={16} />
        </button>
        <button
          className="icon-btn"
          title="Hide (bring it back with the show/hide hotkey)"
          onClick={() => void window.freely.hideOverlay()}
        >
          <Minus size={16} />
        </button>
      </header>

      {!state.settings.onboarded ? (
        <Onboarding state={state} setKey={setKey} done={() => void update({ onboarded: true })} />
      ) : (
        <>
          {!state.hasKey && tab !== 'settings' && (
            <button
              className="border-b border-[var(--border)] bg-amber-400/10 px-3 py-1.5 text-left text-[12px] text-amber-300"
              onClick={() => setTab('settings')}
            >
              Add your free Gemini API key in Settings to start →
            </button>
          )}
          {captureProblem && tab === 'chat' && (
            <div className="border-b border-[var(--border)] p-2.5">
              {captureProblem === 'mac-permission' ? (
                <ScreenPermissionGuide />
              ) : (
                <div className="flex items-center justify-between text-[12px] text-[var(--danger)]">
                  Screen capture failed. Try again, or use region select.
                  <button className="btn" onClick={() => setCaptureProblem(null)}>
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}
          {tab === 'chat' && (
            <ChatPage
              chat={chat}
              hotkeys={state.settings.hotkeys}
              onScreenshot={() => void attach(false)}
              onRegion={() => void attach(true)}
              onQuickPrompt={(p) => void quickPrompt(p)}
            />
          )}
          {tab === 'transcript' && (
            <TranscriptPage
              listen={listen}
              bothSources={bothSources}
              onWhatToSay={() => void whatToSay()}
              onAsk={(p) => sendNow(p)}
            />
          )}
          {tab === 'history' && (
            <HistoryPage
              saveHistory={state.settings.saveHistory}
              onOpen={(c) => {
                chat.open(c)
                setTab('chat')
              }}
            />
          )}
          {tab === 'settings' && <SettingsPage state={state} update={update} setKey={setKey} />}
        </>
      )}
    </div>
  )
}
