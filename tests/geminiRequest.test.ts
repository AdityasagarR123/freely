import type { GenerateContentResponse } from '@google/genai'
import { describe, expect, it } from 'vitest'
import {
  buildContents,
  buildSystemInstruction,
  chunkText,
  collectStream,
  dataUrlToPart,
  friendlyError,
  NoKeyError,
  SafetyBlockError,
} from '../src/main/geminiRequest'
import type { ChatMessage } from '../src/shared/types'

const IMG = 'data:image/jpeg;base64,AAAA'

describe('request building', () => {
  it('converts data URLs into inlineData parts', () => {
    expect(dataUrlToPart(IMG)).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } })
    expect(() => dataUrlToPart('https://example.com/x.png')).toThrow()
  })

  it('maps history to contents with images before text', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', text: 'what is this?', attachments: [{ dataUrl: IMG }] },
      { id: '2', role: 'model', text: 'A cat.' },
      { id: '3', role: 'user', text: 'thanks' },
    ]
    expect(buildContents(messages)).toEqual([
      { role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }, { text: 'what is this?' }] },
      { role: 'model', parts: [{ text: 'A cat.' }] },
      { role: 'user', parts: [{ text: 'thanks' }] },
    ])
  })

  it('adds length and language hints to the system prompt', () => {
    const base = { systemPrompt: 'Be helpful.', responseLength: 'normal' as const, language: 'auto' }
    expect(buildSystemInstruction(base)).toBe('Be helpful.')
    const s = buildSystemInstruction({ ...base, responseLength: 'short', language: 'German' })
    expect(s).toContain('Be helpful.')
    expect(s).toContain('very short')
    expect(s).toContain('Always respond in German.')
  })
})

const chunk = (c: object): GenerateContentResponse => c as GenerateContentResponse

describe('stream parsing', () => {
  it('joins text parts and skips thoughts', () => {
    expect(
      chunkText(
        chunk({
          candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: 'Hel' }, { text: 'lo' }] } }],
        }),
      ),
    ).toBe('Hello')
    expect(chunkText(chunk({ candidates: [] }))).toBe('')
  })

  it('throws on safety blocks', () => {
    expect(() => chunkText(chunk({ promptFeedback: { blockReason: 'SAFETY' } }))).toThrow(SafetyBlockError)
    expect(() => chunkText(chunk({ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }))).toThrow(
      SafetyBlockError,
    )
  })

  it('accumulates a whole stream and reports each piece', async () => {
    async function* stream(): AsyncGenerator<GenerateContentResponse> {
      for (const t of ['a', '', 'b', 'c']) yield chunk({ candidates: [{ content: { parts: t ? [{ text: t }] : [] } }] })
    }
    const pieces: string[] = []
    expect(await collectStream(stream(), (t) => pieces.push(t))).toBe('abc')
    expect(pieces).toEqual(['a', 'b', 'c'])
  })
})

describe('friendly errors', () => {
  it('covers the common failure modes', () => {
    expect(friendlyError(new NoKeyError())).toMatch(/No Gemini API key/)
    expect(friendlyError(new Error('API key not valid. Please pass a valid API key.'))).toMatch(/rejected/)
    expect(friendlyError({ status: 429, message: 'RESOURCE_EXHAUSTED. Please retry in 21.3s.' })).toMatch(/about 22 s/)
    expect(friendlyError(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'))).toMatch(/rate limit/)
    expect(friendlyError(new TypeError('fetch failed'))).toMatch(/internet/)
    expect(friendlyError(new SafetyBlockError('SAFETY'))).toMatch(/safety/)
    expect(friendlyError({ status: 404, message: 'models/x is not found' })).toMatch(/model name/)
  })
})
