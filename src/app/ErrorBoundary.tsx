import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from './monitor';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, `render${info.componentStack ? ' ' + info.componentStack.split('\n')[1]?.trim() : ''}`);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="boot" role="alert">
        <div>
          <h1>Something went wrong</h1>
          <p className="lede">
            Your data is safe. Reload to continue. If this keeps happening, tell us what you were doing.
          </p>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
