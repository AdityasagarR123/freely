import { Component, type ReactNode } from 'react'

/** Shows a recoverable error panel instead of leaving an invisible, empty overlay. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="glass flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-[15px] font-semibold">Freely hit a problem</div>
        <div className="max-w-80 break-words text-[12px] text-[var(--muted)]">{this.state.error.message}</div>
        <button className="btn primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
