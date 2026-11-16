import { useCallback, useEffect, useState } from 'react'
import type { PublicSettings, Settings } from '../../shared/types'

/** Settings mirrored from the main process (which is the source of truth). */
export function useSettings(): {
  state: PublicSettings | null
  update: (patch: Partial<Settings>) => Promise<void>
  setKey: (key: string) => Promise<void>
} {
  const [state, setState] = useState<PublicSettings | null>(null)

  useEffect(() => {
    void window.freely.getSettings().then(setState)
    return window.freely.onSettings(setState)
  }, [])

  useEffect(() => {
    if (state) document.documentElement.dataset.theme = state.settings.theme
  }, [state])

  const update = useCallback(
    async (patch: Partial<Settings>) => setState(await window.freely.updateSettings(patch)),
    [],
  )
  const setKey = useCallback(async (key: string) => setState(await window.freely.setApiKey(key)), [])

  return { state, update, setKey }
}
