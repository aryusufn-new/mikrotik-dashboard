import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 rounded-xl m-4 max-w-xl">
          <h2 className="text-lg font-bold text-rose-700 mb-2">Terjadi error</h2>
          <pre className="text-sm text-rose-600 whitespace-pre-wrap">
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700"
          >
            Coba Lagi
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
