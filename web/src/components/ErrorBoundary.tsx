// Shows what broke instead of a blank page.
import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="sans m-6 max-w-[760px] rounded-sm border border-bad/50 p-4 text-[13px]">
        <div className="text-bad">This screen hit an error and stopped drawing.</div>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{error.stack ?? error.message}</pre>
        <button type="button" onClick={() => this.setState({ error: undefined })} className="mt-3 rounded-sm border border-line-2 px-3 py-1 text-[12px] text-ink hover:border-ug/60">
          try again
        </button>
      </div>
    )
  }
}
