import { t } from './i18n'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { error?: Error }

/** Keeps a render error in one page from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = {}

  static getDerivedStateFromError (error: Error): State {
    return { error }
  }

  componentDidCatch (error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack)
  }

  componentDidUpdate (prev: { resetKey?: string }): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: undefined })
  }

  render (): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className='alert error' role='alert'>
        <strong>{t('Something went wrong on this page.')}</strong> {this.state.error.message}
        <div className='actions'>
          <button type='button' className='button' onClick={() => this.setState({ error: undefined })}>Try again</button>
        </div>
      </div>
    )
  }
}
