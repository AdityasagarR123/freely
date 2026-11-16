/** Types shared by the main process, the preload bridge and the renderer. */

export type HotkeyAction =
  | 'toggleOverlay'
  | 'screenshotAsk'
  | 'regionShot'
  | 'toggleListen'
  | 'whatToSay'
  | 'newChat'
  | 'clickThrough'
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'

export type Hotkeys = Record<HotkeyAction, string>

export type ResponseLength = 'short' | 'normal' | 'detailed'
export type AudioSource = 'mic' | 'system' | 'both'
export type Theme = 'dark' | 'light'

export interface Settings {
  version: number
  textModel: string
  liveModel: string
  systemPrompt: string
  responseLength: ResponseLength
  /** Response language, or 'auto' to answer in the user's language. */
  language: string
  audioSource: AudioSource
  /** deviceId of the microphone (or virtual loopback device), '' = default. */
  micDeviceId: string
  /** Attach a screenshot when asking "What should I say?". */
  screenshotWithSuggestions: boolean
  opacity: number
  theme: Theme
  launchAtLogin: boolean
  saveHistory: boolean
  /** Check GitHub Releases for new versions and install them on quit. */
  autoUpdate: boolean
  /** Uses the OS content-protection flag so the overlay is left out of screen captures and shares. */
  hideFromCapture: boolean
  onboarded: boolean
  hotkeys: Hotkeys
}

/** An image attached to a message, always a JPEG/PNG data URL. */
export interface Attachment {
  dataUrl: string
}

export type Role = 'user' | 'model'

export interface ChatMessage {
  id: string
  role: Role
  text: string
  attachments?: Attachment[]
  error?: boolean
}

export interface ChatSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

export type ChatSummary = Omit<ChatSession, 'messages'>

export type Speaker = 'you' | 'others'

export interface TranscriptSegment {
  id: string
  speaker: Speaker
  text: string
  at: number
}

export interface ScreenPermission {
  /** 'granted' everywhere except macOS when Screen Recording is not allowed. */
  status: 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'
  platform: NodeJS.Platform
}

export interface PublicSettings {
  settings: Settings
  hasKey: boolean
  /** True when the key had to be stored without OS encryption. */
  keyInsecure: boolean
  hotkeyErrors: string[]
}

export type StreamEvent =
  | { requestId: string; type: 'chunk'; text: string }
  | { requestId: string; type: 'done' }
  | { requestId: string; type: 'error'; message: string }

export type ListenEvent =
  | { type: 'segment'; segment: TranscriptSegment }
  | { type: 'status'; listening: boolean; mode?: 'live' | 'chunked'; message?: string }

/** The API exposed to the renderer as `window.freely`. */
export interface FreelyApi {
  platform: NodeJS.Platform
  getSettings(): Promise<PublicSettings>
  updateSettings(patch: Partial<Settings>): Promise<PublicSettings>
  setApiKey(key: string): Promise<PublicSettings>
  testApiKey(key?: string): Promise<{ ok: boolean; message: string }>

  chatSend(requestId: string, messages: ChatMessage[]): Promise<void>
  chatAbort(requestId: string): Promise<void>
  /** One-shot (non-streamed) request, used for transcript helpers. */
  complete(prompt: string, attachments?: Attachment[]): Promise<string>

  captureScreen(): Promise<Attachment | null>
  captureRegion(): Promise<Attachment | null>
  screenPermission(): Promise<ScreenPermission>
  openScreenSettings(): Promise<void>
  requestMicAccess(): Promise<boolean>

  listenStart(sources: Speaker[]): Promise<{ mode: 'live' | 'chunked' }>
  listenStop(): Promise<void>
  /** Streams 16 kHz mono 16-bit PCM to the main process. */
  sendAudio(speaker: Speaker, pcm: ArrayBuffer): void
  saveTranscript(markdown: string): Promise<string | null>

  listChats(): Promise<ChatSummary[]>
  loadChat(id: string): Promise<ChatSession | null>
  saveChat(chat: ChatSession): Promise<void>
  deleteChat(id: string): Promise<void>
  clearChats(): Promise<void>

  openExternal(url: string): Promise<void>
  hideOverlay(): Promise<void>

  onStream(cb: (e: StreamEvent) => void): () => void
  onListen(cb: (e: ListenEvent) => void): () => void
  /** Global hotkeys forwarded by the main process, plus 'openSettings' from the tray menu. */
  onHotkey(cb: (action: HotkeyAction | 'openSettings') => void): () => void
  onClickThrough(cb: (on: boolean) => void): () => void
  onSettings(cb: (s: PublicSettings) => void): () => void
}

/** API exposed to the region selector window as `window.freelyRegion`. */
export interface RegionApi {
  getImage(): Promise<string>
  done(rect: { x: number; y: number; width: number; height: number } | null): void
}
