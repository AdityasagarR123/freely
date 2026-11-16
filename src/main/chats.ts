/** Chat history stored as one JSON file per chat in <userData>/chats. Never leaves the machine. */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { ChatSession, ChatSummary } from '../shared/types'

const dir = (): string => join(app.getPath('userData'), 'chats')
const SAFE_ID = /^[\w-]{1,64}$/

function fileFor(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error('Invalid chat id')
  return join(dir(), `${id}.json`)
}

export async function listChats(): Promise<ChatSummary[]> {
  await mkdir(dir(), { recursive: true })
  const files = (await readdir(dir())).filter((f) => f.endsWith('.json'))
  const chats = await Promise.all(
    files.map(async (f) => {
      try {
        const { id, title, createdAt, updatedAt } = JSON.parse(await readFile(join(dir(), f), 'utf8')) as ChatSession
        return { id, title, createdAt, updatedAt }
      } catch {
        return null // skip corrupt files rather than failing the whole list
      }
    }),
  )
  return chats.filter((c): c is ChatSummary => !!c).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadChat(id: string): Promise<ChatSession | null> {
  try {
    return JSON.parse(await readFile(fileFor(id), 'utf8')) as ChatSession
  } catch {
    return null
  }
}

export async function saveChat(chat: ChatSession): Promise<void> {
  await mkdir(dir(), { recursive: true })
  await writeFile(fileFor(chat.id), JSON.stringify(chat), 'utf8')
}

export async function deleteChat(id: string): Promise<void> {
  await rm(fileFor(id), { force: true })
}

export async function clearChats(): Promise<void> {
  await rm(dir(), { recursive: true, force: true })
}
