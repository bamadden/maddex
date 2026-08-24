import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3 p-6 text-center font-mono">
        <div className="text-2xl">⚠</div>
        <div className="text-xs text-terminal-text-bright font-bold">
          {this.props.label ? `${this.props.label} hit an error` : 'Something went wrong'}
        </div>
        <div className="text-2xs text-terminal-text-dim max-w-sm leading-relaxed">
          {this.state.error?.message ?? 'An unexpected error occurred rendering this section.'}
        </div>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          className="mt-1 text-2xs px-3 py-1.5 border border-terminal-gold text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg transition-colors font-bold"
        >
          RETRY
        </button>
      </div>
    )
  }
}
