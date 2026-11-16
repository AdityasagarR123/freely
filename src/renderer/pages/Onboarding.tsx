import { useEffect, useState } from 'react'
import { HOTKEY_LABELS } from '../../shared/defaults'
import { prettyAccelerator } from '../../shared/hotkeys'
import type { HotkeyAction, PublicSettings, ScreenPermission } from '../../shared/types'
import { KeyField } from './SettingsPage'

const SHOWN: HotkeyAction[] = [
  'toggleOverlay',
  'screenshotAsk',
  'regionShot',
  'toggleListen',
  'whatToSay',
  'clickThrough',
]

export function Onboarding({
  state,
  setKey,
  done,
}: {
  state: PublicSettings
  setKey: (k: string) => Promise<void>
  done: () => void
}): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [screen, setScreen] = useState<ScreenPermission | null>(null)
  const [mic, setMic] = useState<boolean | null>(null)

  useEffect(() => {
    if (step === 1) void window.freely.screenPermission().then(setScreen)
  }, [step])

  const pages = [
    <>
      <h2 className="text-lg font-semibold">Welcome to Freely 👋</h2>
      <p className="text-[var(--muted)]">
        A free AI overlay powered by your own Gemini key. Paste it below. It's free from Google AI Studio.
      </p>
      <KeyField hasKey={state.hasKey} keyInsecure={state.keyInsecure} setKey={setKey} />
    </>,
    <>
      <h2 className="text-lg font-semibold">Permissions</h2>
      <p className="text-[var(--muted)]">
        Freely only captures your screen when you ask, and only listens while the red “● Listening” badge is shown.
      </p>
      {screen?.platform === 'darwin' && screen.status !== 'granted' ? (
        <ScreenPermissionGuide />
      ) : (
        <div className="text-emerald-400">✓ Screen capture available</div>
      )}
      <div className="flex items-center gap-2">
        <button
          className="btn"
          onClick={async () => {
            try {
              await window.freely.requestMicAccess()
              const s = await navigator.mediaDevices.getUserMedia({ audio: true })
              s.getTracks().forEach((t) => t.stop())
              setMic(true)
            } catch {
              setMic(false)
            }
          }}
        >
          Allow microphone
        </button>
        {mic === true && <span className="text-emerald-400">✓ Microphone allowed</span>}
        {mic === false && <span className="text-[var(--danger)]">Denied. Enable it in your OS privacy settings.</span>}
      </div>
    </>,
    <>
      <h2 className="text-lg font-semibold">Hotkeys</h2>
      <div className="space-y-1">
        {SHOWN.map((a) => (
          <div key={a} className="flex justify-between">
            <span>{HOTKEY_LABELS[a]}</span>
            <kbd className="rounded bg-[var(--surface-hover)] px-1.5 font-mono text-[12px]">
              {prettyAccelerator(state.settings.hotkeys[a], window.freely.platform)}
            </kbd>
          </div>
        ))}
      </div>
      <p className="text-[var(--muted)]">
        Move the window with Ctrl/Cmd + Alt + arrow keys. Rebind everything in Settings.
      </p>
    </>,
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 py-5">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">{pages[step]}</div>
      <div className="flex items-center justify-between pt-3">
        <div className="flex gap-1.5">
          {pages.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-5 rounded-full ${i === step ? 'bg-[var(--accent)]' : 'bg-[var(--surface-hover)]'}`}
            />
          ))}
        </div>
        <div className="flex gap-1.5">
          {step > 0 && (
            <button className="btn" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button className="btn primary" onClick={() => (step === pages.length - 1 ? done() : setStep(step + 1))}>
            {step === pages.length - 1 ? 'Start' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** macOS-only guide for granting Screen Recording. */
export function ScreenPermissionGuide(): React.JSX.Element {
  return (
    <div className="space-y-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-[12.5px]">
      <div className="font-medium text-amber-300">Screen Recording permission needed</div>
      <ol className="list-decimal space-y-0.5 pl-4 text-[var(--muted)]">
        <li>Open System Settings → Privacy &amp; Security → Screen &amp; System Audio Recording.</li>
        <li>Turn on Freely.</li>
        <li>Quit and reopen Freely.</li>
      </ol>
      <button className="btn" onClick={() => void window.freely.openScreenSettings()}>
        Open System Settings
      </button>
    </div>
  )
}
