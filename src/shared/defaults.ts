import type { Hotkeys, Settings } from './types'

/**
 * The only place model names live. Both are editable in Settings.
 * Checked against https://ai.google.dev/gemini-api/docs/models (Nov 2026).
 */
export const DEFAULT_TEXT_MODEL = 'gemini-3.8-flash'
export const DEFAULT_LIVE_MODEL = 'gemini-3.8-live'

export const LIVE_AUDIO_MIME = 'audio/pcm;rate=16000'
export const AUDIO_SAMPLE_RATE = 16000

export const DEFAULT_SYSTEM_PROMPT = `You are Freely, a concise desktop assistant that floats over the user's screen.
- Be direct. Lead with the answer, then the minimum explanation needed.
- Prefer short bullet points and fenced code blocks with a language tag.
- When given a screenshot, address what is visible directly (the code, question, error or document on screen) without describing the screenshot itself.
- If something on screen is ambiguous, state your best interpretation in one line and answer it.`

export const DEFAULT_HOTKEYS: Hotkeys = {
  toggleOverlay: 'CommandOrControl+\\',
  screenshotAsk: 'CommandOrControl+Enter',
  regionShot: 'CommandOrControl+Shift+S',
  toggleListen: 'CommandOrControl+Shift+L',
  whatToSay: 'CommandOrControl+Shift+Enter',
  newChat: 'CommandOrControl+Shift+R',
  clickThrough: 'CommandOrControl+Shift+M',
  moveUp: 'CommandOrControl+Up',
  moveDown: 'CommandOrControl+Down',
  moveLeft: 'CommandOrControl+Left',
  moveRight: 'CommandOrControl+Right',
}

export const HOTKEY_LABELS: Record<keyof Hotkeys, string> = {
  toggleOverlay: 'Show / hide overlay',
  screenshotAsk: 'Screenshot + ask',
  regionShot: 'Region screenshot',
  toggleListen: 'Start / stop listening',
  whatToSay: '"What should I say?"',
  newChat: 'New chat',
  clickThrough: 'Click-through toggle',
  moveUp: 'Move window up',
  moveDown: 'Move window down',
  moveLeft: 'Move window left',
  moveRight: 'Move window right',
}

export const SETTINGS_VERSION = 2

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  textModel: DEFAULT_TEXT_MODEL,
  liveModel: DEFAULT_LIVE_MODEL,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  responseLength: 'normal',
  language: 'auto',
  audioSource: 'both',
  micDeviceId: '',
  screenshotWithSuggestions: false,
  opacity: 0.95,
  theme: 'dark',
  launchAtLogin: false,
  saveHistory: true,
  hideFromCapture: true,
  onboarded: false,
  hotkeys: DEFAULT_HOTKEYS,
}

export const WINDOW_SIZE = { width: 520, height: 640 }
export const MOVE_STEP_PX = 40
export const SCREENSHOT_MAX_WIDTH = 1920
export const SCREENSHOT_JPEG_QUALITY = 80

export const DEFAULT_SCREEN_PROMPT = "Help me with what's on my screen."

/** Prompts used by the transcript helpers and the quick-prompt row. */
export const PROMPTS = {
  whatToSay: (transcript: string) =>
    `Here is the last few minutes of a live conversation I'm in ("You" is me, "Others" are the other people):\n\n${transcript}\n\nSuggest 2–3 short replies I could say next. Each one or two sentences, natural spoken tone. If someone asked me a question, answer it first.`,
  summarize: (transcript: string) =>
    `Summarize this conversation transcript.\n\n${transcript}\n\nUse these sections: **Summary** (bullets), **Decisions**, **Action items** (who → what). Write "None" for an empty section.`,
  explainThat: (transcript: string) =>
    `Here is a recent conversation transcript:\n\n${transcript}\n\nExplain the last thing that was said in simple terms, with a quick example if it helps.`,
  transcribe:
    'Transcribe this audio verbatim. Output only the spoken words, no labels or commentary. Output nothing if there is no speech.',
  liveInstruction: 'You are a silent transcription listener. Never reply. Do not produce any output.',
}

export const QUICK_PROMPTS = [
  { label: 'Explain', prompt: 'Explain this clearly and briefly.' },
  { label: 'Summarize', prompt: 'Summarize this in a few bullets.' },
  { label: 'Fix this code', prompt: 'Find the bugs in this code and give the fixed version.' },
  { label: 'Translate', prompt: 'Translate this into English (or into the response language if one is set).' },
  { label: 'Reply to this', prompt: 'Draft a short, friendly reply to this message.' },
] as const

export const LENGTH_HINTS = {
  short: 'Keep answers very short: 1–3 sentences or a few bullets.',
  normal: '',
  detailed: 'Give thorough, detailed answers with explanations and examples.',
} as const
