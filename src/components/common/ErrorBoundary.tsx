import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI. Receives the caught error. */
  fallback?: (error: Error) => ReactNode;
  /** Display name used in the default fallback heading (e.g. "Supervisor Dashboard"). */
  pageName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * A reusable React Error Boundary.
 *
 * Catches errors thrown during rendering of its children (including errors
 * from lazy-loaded chunks) and renders a graceful fallback UI instead of
 * crashing the entire application.
 *
 * Usage:
 *   <ErrorBoundary pageName="Supervisor Dashboard">
 *     <SupervisorDashboard />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback, pageName } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error);
      }

      // Default fallback UI
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            padding: '40px',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              marginBottom: '16px',
            }}
          >
            ⚠️
          </div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: '8px',
            }}
          >
            {pageName ? `Failed to load "${pageName}"` : 'Something went wrong'}
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: '#64748b',
              marginBottom: '4px',
              maxWidth: '480px',
            }}
          >
            This page encountered an unexpected error and could not be displayed.
          </p>
          <p
            style={{
              fontSize: '12px',
              color: '#94a3b8',
              fontFamily: 'monospace',
              marginBottom: '24px',
              maxWidth: '480px',
              wordBreak: 'break-word',
            }}
          >
            {error.message}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '8px 24px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#fff',
              background: '#6366f1',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
