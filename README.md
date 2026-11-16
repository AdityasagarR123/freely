# Freely

**A free, open-source AI overlay for your desktop, powered by your own Gemini API key.**

Freely is a small, translucent, always-on-top chat panel that floats over your other windows. With one hotkey it can:

- 📷 **See your screen.** Take a screenshot (or drag a region) and get help with whatever is on it: code, errors, docs, slides, forms.
- 🎙️ **Listen live.** Transcribe your microphone and your computer's audio (meetings, calls, lectures, videos) in real time, then suggest what to say, summarize, or explain the last point.
- 💬 **Chat.** Ask typed questions with full conversation memory, Markdown answers and syntax-highlighted code.

It is 100% free: **no backend, no accounts, no telemetry.** The only network traffic is to Google's Gemini API, using a key you paste in.

> _Screenshots: coming soon._

---

## Setup

### 1. Get a free Gemini API key

1. Go to **<https://aistudio.google.com/apikey>** and sign in with a Google account.
2. Click **Create API key** and copy it.
3. Paste it into Freely (onboarding or **Settings → API key**), then press **Test key**.

The free tier has rate limits. If you hit one, Freely tells you how long to wait.

### 2. Install

Download the installer for your OS from the Releases page, **or** build from source:

```bash
git clone <this repo> freely && cd freely
npm install
npm run dev        # run with hot reload
npm run build      # production build into out/
npm run dist       # installer for the current OS into dist/
```

Requires Node 20+. Other scripts: `npm test`, `npm run lint`, `npm run typecheck`, `npm run icons` (regenerates icons from `build/icon.svg`).

## Hotkeys

All hotkeys can be rebound in **Settings → Hotkeys** (conflicts are detected). `Ctrl` is `⌘ Cmd` on macOS.

| Action                 | Default                                            |
| ---------------------- | -------------------------------------------------- |
| Show / hide overlay    | `Ctrl + \`                                         |
| Screenshot + ask       | `Ctrl + Enter`                                     |
| Region screenshot      | `Ctrl + Shift + S`                                 |
| Start / stop listening | `Ctrl + Shift + L`                                 |
| "What should I say?"   | `Ctrl + Shift + Enter`                             |
| New chat               | `Ctrl + Shift + R`                                 |
| Click-through toggle   | `Ctrl + Shift + M`                                 |
| Move window            | `Ctrl + Alt + Arrow keys` (40 px, stays on screen) |

These are **global** shortcuts, so while Freely runs they take priority over other apps. For example, `Ctrl + Enter` is taken from other apps while Freely runs. Rebind any that get in your way.

In the chat box: **Enter** sends, **Shift + Enter** adds a new line, and **Ctrl/Cmd + V** pastes an image.

## Features

- **Overlay:** frameless glass panel, always on top, on all workspaces and over full-screen apps, hidden from the taskbar/dock, with a tray icon (Show/Hide, Settings, Quit). Drag it by the header and resize it; position and size are remembered. Opacity can be set from 40 to 100%.
- **Click-through mode:** your clicks go to the window underneath, so you can read while working. A badge shows when it's on, and the same hotkey turns it off.
- **Streaming chat:** with a Stop button, multi-turn memory, copy buttons on each message and code block, and friendly errors (no key, bad key, rate limit, offline, safety block).
- **Screen understanding:** full-screen capture of the display your cursor is on, region select, clipboard paste, a 📷 button with thumbnail preview, and automatic downscaling (≤ 1920 px, JPEG 80%).
- **Quick prompts:** Explain, Summarize, Fix this code, Translate and Reply to this. Each works on your typed text or attachment, or on a fresh screenshot if there's nothing.
- **Live listening:** microphone, system audio, or both (labelled **You** / **Others**). A red **● Listening** indicator always shows while audio is captured. Audio streams to the Gemini Live API. If that isn't available, it falls back to sending 10-second chunks.
- **Transcript tools:** _What should I say?_ (2–3 suggested replies from the last 3 minutes, optionally with a screenshot), _Summarize_ (bullets, decisions, action items), _Explain that_, and **Save as Markdown** (transcript + AI summary).
- **Settings:** API key (encrypted), models, system prompt, response length, language, audio source/mic, opacity, theme, launch at login, history on/off, and all hotkeys.
- **History:** chats are saved as local JSON files. You can reopen or delete them, clear all, or turn saving off.
- **Hide from screen capture (on by default):** asks the OS to leave the overlay out of screenshots, recordings and screen shares (Windows 10 2004+ and macOS). It's a privacy option for your own notes, not a guarantee: some capture tools ignore it.

## Permissions per OS

|             | Screen capture                                                                                                                                        | Microphone                                                        | System audio                                                                                                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows** | Works out of the box                                                                                                                                  | Allow when Windows asks, or under Settings → Privacy → Microphone | Built in (WASAPI loopback)                                                                                                                                                                                                                               |
| **macOS**   | System Settings → Privacy & Security → **Screen & System Audio Recording** → enable Freely, then restart it. Freely shows a guide if this is missing. | Allow on the first prompt                                         | Uses Electron's loopback capture on recent macOS. If unavailable, install a virtual device such as [BlackHole](https://existential.audio/blackhole/), route output through it, pick it as the microphone in Settings, and use the **Microphone** source. |
| **Linux**   | Works on X11. Wayland may show a portal picker or fail.                                                                                               | PulseAudio/PipeWire input                                         | Use a monitor source (e.g. "Monitor of …") as the microphone, or the system-audio option where supported                                                                                                                                                 |

## Troubleshooting

- **"API key was rejected":** re-copy the key from AI Studio; make sure there are no spaces.
- **"Rate limit reached":** the free tier allows a limited number of requests per minute/day. Wait and retry, or switch to a lighter model in Settings.
- **"Model name was not found":** Google renames models from time to time. Put the current names from <https://ai.google.dev/gemini-api/docs/models> into Settings. The defaults live in `src/shared/defaults.ts`.
- **Listening shows "chunked mode":** the Live model couldn't be opened (wrong name or not available for your key). Transcription still works, just in 10-second steps.
- **A hotkey doesn't work:** another app already owns it. Settings lists the failures; rebind it.
- **Black or empty screenshots on macOS:** grant Screen Recording permission and restart Freely.
- **Overlay is gone:** use the tray icon or the show/hide hotkey. If it ended up off-screen after unplugging a monitor, it moves back on the next launch.

## Privacy

- Nothing leaves your machine **except** requests to Google's Gemini API (`generativelanguage.googleapis.com`), made from the app's main process with your key.
- The key is encrypted with your OS keychain (Electron `safeStorage`). If no keychain is available, Freely warns you and stores it unencrypted in its settings file.
- Chat history and settings are stored locally in your user-data folder. Turn history off in Settings, or clear it at any time.
- Audio is captured only while the red **● Listening** indicator is visible. Screenshots are taken only when you ask.
- No analytics, no crash reporting, no update pings.

Google's [Gemini API terms](https://ai.google.dev/gemini-api/terms) apply to what you send. On the free tier, Google may use inputs to improve its products.

## Architecture

```
src/
  main/       Electron main process: windows, tray, hotkeys, capture, Gemini calls, audio/Live sessions, storage, IPC
  preload/    Typed bridges: window.freely (overlay) and window.freelyRegion (region selector)
  renderer/   React + Tailwind UI (pages/, components/, hooks/), AudioWorklet in public/
  shared/     Types, defaults (model names, prompts, hotkeys), pure helpers
tests/        Vitest unit tests
```

Security: `contextIsolation`, `sandbox` and no `nodeIntegration`; a strict Content-Security-Policy; IPC handlers accept calls only from the overlay window; navigation and pop-ups are blocked; and the API key never reaches the renderer.

## License

[MIT](LICENSE)
