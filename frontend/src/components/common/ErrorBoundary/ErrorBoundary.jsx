import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught render error:', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div className="glass-surface w-full max-w-md rounded-2xl p-8 text-center">
          <p
            className="mb-2 font-mono text-[11px] tracking-widest"
            style={{ color: 'var(--signal-negative)' }}
          >
            SOMETHING WENT WRONG
          </p>
          <h1
            className="mb-2 text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Unexpected error occurred
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Reload the page. If the error persists, kindly contact support
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                background: 'transparent',
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
