import { useState } from 'react'
import { acceleratorFromEvent, isValidAccelerator, prettyAccelerator } from '../../shared/hotkeys'

/** Click, then press a key combination to rebind. Esc cancels, Backspace clears. */
export function HotkeyInput({
  value,
  onChange,
  invalid,
}: {
  value: string
  onChange: (v: string) => void
  invalid?: boolean
}): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  return (
    <button
      className={`field w-auto! min-w-36 text-left font-mono text-[12px] ${recording ? 'border-[var(--accent)]!' : ''} ${invalid ? 'border-[var(--danger)]!' : ''}`}
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={(e) => {
        if (!recording) return
        e.preventDefault()
        if (e.key === 'Escape') return setRecording(false)
        if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey) {
          onChange('')
          return setRecording(false)
        }
        const accel = acceleratorFromEvent(e)
        if (accel && isValidAccelerator(accel)) {
          onChange(accel)
          setRecording(false)
        }
      }}
    >
      {recording ? 'Press keys…' : value ? prettyAccelerator(value, window.freely.platform) : 'Not set'}
    </button>
  )
}
