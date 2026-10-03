import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { btnPrimary } from './styles'

interface State {
  failed: boolean
}

/** Last line of defence: shows a recovery screen if rendering throws. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-ink-soft">
          Reload the page to continue. Your applications are safe on the server.
        </p>
        <button type="button" className={`${btnPrimary} mt-4`} onClick={() => location.reload()}>
          Reload the page
        </button>
      </main>
    )
  }
}
