import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureError } from "../lib/sentry";

/** Last line of defence: a render crash shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    captureError(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="grid min-h-screen place-items-center bg-ink-900 p-6 text-center text-white">
        <div className="max-w-sm">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-white/70">The radio hit an unexpected error. Reloading usually fixes it.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 min-h-11 rounded-xl bg-lilac px-5 py-2.5 font-bold text-ink-900 hover:bg-lilac-300"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
