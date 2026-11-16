import { Check, Copy } from 'lucide-react'
import { memo, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../../shared/types'
import { copyText } from '../lib/util'

function CopyButton({ text, className = '' }: { text: string; className?: string }): React.JSX.Element {
  const [done, setDone] = useState(false)
  return (
    <button
      className={`icon-btn h-6! w-6! ${className}`}
      title="Copy"
      onClick={() => {
        void copyText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        })
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

/** Plain text of a rendered code element, for the copy button. */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node && typeof node === 'object' && 'props' in node)
    return textOf((node.props as { children?: ReactNode }).children)
  return ''
}

const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => (
            <div className="group relative">
              <pre>{children}</pre>
              <CopyButton
                text={textOf(children).replace(/\n$/, '')}
                className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100"
              />
            </div>
          ),
          a: ({ href, children }) => (
            <a onClick={() => href && void window.freely.openExternal(href)} title={href}>
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})

export function Message({ message, streaming }: { message: ChatMessage; streaming: boolean }): React.JSX.Element {
  const images = message.attachments ?? []
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-[var(--accent-tint)] px-3 py-2">
          {images.length > 0 && (
            <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
              {images.map((a, i) => (
                <img
                  key={i}
                  src={a.dataUrl}
                  className="max-h-28 rounded-md border border-[var(--border)]"
                  alt="Attached screenshot"
                />
              ))}
            </div>
          )}
          {message.text && <div className="whitespace-pre-wrap break-words">{message.text}</div>}
        </div>
      </div>
    )
  }
  return (
    <div className="group/msg">
      {message.error ? (
        <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-[var(--danger)]">
          {message.text}
        </div>
      ) : message.text ? (
        <Markdown text={message.text} />
      ) : streaming ? (
        <div className="flex gap-1 py-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="listening-dot h-1.5 w-1.5 rounded-full bg-[var(--muted)]"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      ) : (
        <div className="text-[var(--muted)]">(no response)</div>
      )}
      {!streaming && message.text && !message.error && (
        <div className="mt-1 opacity-0 transition-opacity group-hover/msg:opacity-100">
          <CopyButton text={message.text} />
        </div>
      )}
    </div>
  )
}
