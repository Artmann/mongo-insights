import { Component } from 'react'
import type { ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center gap-4 text-center">
          <h2 className="text-lg font-semibold">Something went wrong</h2>

          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.error.message}
          </p>

          <button
            className="text-sm text-primary underline underline-offset-4"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
