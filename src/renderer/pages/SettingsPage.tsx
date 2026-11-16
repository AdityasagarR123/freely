import { useEffect, useState, type ReactNode } from 'react'
import {
  DEFAULT_HOTKEYS,
  DEFAULT_LIVE_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEXT_MODEL,
  HOTKEY_LABELS,
} from '../../shared/defaults'
import { findConflicts, prettyAccelerator } from '../../shared/hotkeys'
import type { HotkeyAction, Hotkeys, PublicSettings, Settings } from '../../shared/types'
import { HotkeyInput } from '../components/HotkeyInput'

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <label className="block">
      <div className="mb-1 text-[12px] font-medium">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11.5px] text-[var(--muted)]">{hint}</div>}
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{title}</h3>
      {children}
    </section>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        className="mt-0.5 accent-[var(--accent)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-[12.5px]">{label}</span>
        {hint && <span className="block text-[11.5px] text-[var(--muted)]">{hint}</span>}
      </span>
    </label>
  )
}

/** API key field with save + test, shared with onboarding. */
export function KeyField({
  hasKey,
  keyInsecure,
  setKey,
}: {
  hasKey: boolean
  keyInsecure: boolean
  setKey: (k: string) => Promise<void>
}): React.JSX.Element {
  const [key, setKeyInput] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <input
          type="password"
          className="field"
          value={key}
          placeholder={hasKey ? '•••••••••••• (saved — paste to replace)' : 'Paste your Gemini API key'}
          onChange={(e) => setKeyInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className="btn primary"
          disabled={!key.trim() || busy}
          onClick={async () => {
            setBusy(true)
            await setKey(key)
            setKeyInput('')
            setStatus(await window.freely.testApiKey())
            setBusy(false)
          }}
        >
          Save
        </button>
        <button
          className="btn"
          disabled={(!hasKey && !key.trim()) || busy}
          onClick={async () => {
            setBusy(true)
            setStatus(await window.freely.testApiKey(key || undefined))
            setBusy(false)
          }}
        >
          {busy ? 'Testing…' : 'Test key'}
        </button>
      </div>
      {status && (
        <div className={`text-[12px] ${status.ok ? 'text-emerald-400' : 'text-[var(--danger)]'}`}>{status.message}</div>
      )}
      {keyInsecure && (
        <div className="text-[12px] text-amber-400">
          Your OS has no secure storage available, so the key is saved unencrypted in Freely's settings file.
        </div>
      )}
      <div className="text-[11.5px] text-[var(--muted)]">
        Free key:{' '}
        <a
          className="cursor-pointer text-[var(--accent)] underline"
          onClick={() => void window.freely.openExternal('https://aistudio.google.com/apikey')}
        >
          aistudio.google.com/apikey
        </a>
        . Stored encrypted on this computer and only ever sent to Google.
      </div>
    </div>
  )
}

interface Props {
  state: PublicSettings
  update: (patch: Partial<Settings>) => Promise<void>
  setKey: (key: string) => Promise<void>
}

export function SettingsPage({ state, update, setKey }: Props): React.JSX.Element {
  const s = state.settings
  const [prompt, setPrompt] = useState(s.systemPrompt)
  const [models, setModels] = useState({ textModel: s.textModel, liveModel: s.liveModel })
  const [language, setLanguage] = useState(s.language)
  const [hotkeys, setHotkeys] = useState<Hotkeys>(s.hotkeys)
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    void navigator.mediaDevices.enumerateDevices().then((d) => setMics(d.filter((x) => x.kind === 'audioinput')))
  }, [])

  const conflicts = findConflicts(hotkeys)
  const conflicted = new Set(conflicts.flat())
  const setHotkey = (action: HotkeyAction, accel: string): void => {
    const next = { ...hotkeys, [action]: accel }
    setHotkeys(next)
    if (!findConflicts(next).length) void update({ hotkeys: next })
  }

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
      <Section title="Gemini">
        <Row label="API key">
          <KeyField hasKey={state.hasKey} keyInsecure={state.keyInsecure} setKey={setKey} />
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Row label="Text / vision model">
            <input
              className="field"
              value={models.textModel}
              onChange={(e) => setModels({ ...models, textModel: e.target.value })}
              onBlur={() => void update(models)}
              placeholder={DEFAULT_TEXT_MODEL}
            />
          </Row>
          <Row label="Live audio model">
            <input
              className="field"
              value={models.liveModel}
              onChange={(e) => setModels({ ...models, liveModel: e.target.value })}
              onBlur={() => void update(models)}
              placeholder={DEFAULT_LIVE_MODEL}
            />
          </Row>
        </div>
        <Row
          label="System prompt"
          hint={
            <button
              className="underline"
              onClick={() => {
                setPrompt(DEFAULT_SYSTEM_PROMPT)
                void update({ systemPrompt: DEFAULT_SYSTEM_PROMPT })
              }}
            >
              Reset to default
            </button>
          }
        >
          <textarea
            className="field min-h-28 font-mono text-[12px]"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onBlur={() => void update({ systemPrompt: prompt })}
          />
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Row label="Response length">
            <select
              className="field"
              value={s.responseLength}
              onChange={(e) => void update({ responseLength: e.target.value as Settings['responseLength'] })}
            >
              <option value="short">Short</option>
              <option value="normal">Normal</option>
              <option value="detailed">Detailed</option>
            </select>
          </Row>
          <Row label="Language" hint='"auto" = same as your message'>
            <input
              className="field"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              onBlur={() => void update({ language: language.trim() || 'auto' })}
            />
          </Row>
        </div>
      </Section>

      <Section title="Listening">
        <div className="grid grid-cols-2 gap-2">
          <Row label="Audio source">
            <select
              className="field"
              value={s.audioSource}
              onChange={(e) => void update({ audioSource: e.target.value as Settings['audioSource'] })}
            >
              <option value="mic">Microphone</option>
              <option value="system">System audio</option>
              <option value="both">Both</option>
            </select>
          </Row>
          <Row label="Microphone">
            <select
              className="field"
              value={s.micDeviceId}
              onChange={(e) => void update({ micDeviceId: e.target.value })}
            >
              <option value="">System default</option>
              {mics
                .filter((m) => m.deviceId && m.deviceId !== 'default')
                .map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label || 'Microphone'}
                  </option>
                ))}
            </select>
          </Row>
        </div>
        <Toggle
          checked={s.screenshotWithSuggestions}
          onChange={(v) => void update({ screenshotWithSuggestions: v })}
          label='Include a screenshot with "What should I say?"'
        />
      </Section>

      <Section title="Appearance & behaviour">
        <Row label={`Opacity — ${Math.round(s.opacity * 100)}%`}>
          <input
            type="range"
            min={40}
            max={100}
            className="w-full accent-[var(--accent)]"
            value={Math.round(s.opacity * 100)}
            onChange={(e) => void update({ opacity: Number(e.target.value) / 100 })}
          />
        </Row>
        <Row label="Theme">
          <select
            className="field"
            value={s.theme}
            onChange={(e) => void update({ theme: e.target.value as Settings['theme'] })}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </Row>
        {window.freely.platform !== 'linux' && (
          <Toggle
            checked={s.launchAtLogin}
            onChange={(v) => void update({ launchAtLogin: v })}
            label="Launch at login"
          />
        )}
        <Toggle
          checked={s.saveHistory}
          onChange={(v) => void update({ saveHistory: v })}
          label="Save chat history on this computer"
        />
        <Toggle
          checked={s.autoUpdate}
          onChange={(v) => void update({ autoUpdate: v })}
          label="Update automatically"
          hint="Checks this project's GitHub releases every few hours; updates install when you quit Freely."
        />
        <Toggle
          checked={s.showTrayIcon}
          onChange={(v) => void update({ showTrayIcon: v })}
          label="Show tray icon"
          hint={`When off, open Freely with ${prettyAccelerator(s.hotkeys.toggleOverlay, window.freely.platform)} or from the Start menu, and quit it with the button at the bottom of Settings.`}
        />
        <Toggle
          checked={s.hideFromCapture}
          onChange={(v) => void update({ hideFromCapture: v })}
          label="Hide from screen capture"
          hint="Uses the OS content-protection flag so the overlay is left out of screenshots, recordings and screen shares, like private presenter notes. Some capture tools may still show it."
        />
      </Section>

      <Section title="Hotkeys">
        <div className="space-y-1.5">
          {(Object.keys(HOTKEY_LABELS) as HotkeyAction[]).map((a) => (
            <div key={a} className="flex items-center justify-between gap-2">
              <span className="text-[12.5px]">{HOTKEY_LABELS[a]}</span>
              <HotkeyInput value={hotkeys[a]} invalid={conflicted.has(a)} onChange={(v) => setHotkey(a, v)} />
            </div>
          ))}
        </div>
        {conflicts.length > 0 && (
          <div className="text-[12px] text-[var(--danger)]">
            Same shortcut used twice: {conflicts.map((g) => g.map((a) => HOTKEY_LABELS[a]).join(' & ')).join('; ')}. Not
            saved until fixed.
          </div>
        )}
        {state.hotkeyErrors.map((e) => (
          <div key={e} className="text-[12px] text-amber-400">
            {e}
          </div>
        ))}
        <button
          className="btn"
          onClick={() => {
            setHotkeys(DEFAULT_HOTKEYS)
            void update({ hotkeys: DEFAULT_HOTKEYS })
          }}
        >
          Reset hotkeys
        </button>
      </Section>

      <button className="btn danger w-full justify-center" onClick={() => void window.freely.quitApp()}>
        Quit Freely
      </button>

      <div className="pb-2 text-center text-[11px] text-[var(--muted)]">
        Freely · MIT · no accounts, no telemetry. Data goes only to Google's Gemini API.
      </div>
    </div>
  )
}
