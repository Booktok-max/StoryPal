import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("StoryPals error boundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#fdfbf7] p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-amber-200 text-center">
            <div className="text-5xl mb-4">📚</div>
            <h1 className="font-bold text-xl text-stone-800 mb-2">
              Oops! StoryPals hit a snag
            </h1>
            <p className="text-sm text-stone-600 mb-6 leading-relaxed">
              Something went wrong, but your reading progress is safe! Try refreshing the page.
            </p>
            <button
              onClick={this.handleReset}
              className="px-6 py-3 rounded-2xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-colors shadow-md"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="ml-3 px-6 py-3 rounded-2xl bg-stone-200 text-stone-700 font-bold text-sm hover:bg-stone-300 transition-colors"
            >
              Refresh Page
            </button>
            {this.state.error && (
              <details className="mt-6 text-left text-xs text-stone-400">
                <summary className="cursor-pointer hover:text-stone-600">Technical details</summary>
                <pre className="mt-2 p-3 bg-stone-50 rounded-xl overflow-x-auto whitespace-pre-wrap">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
