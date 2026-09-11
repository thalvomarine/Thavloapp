import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Isolates chart / Leaflet failures from the mission dock so SOS stays
 * clickable even when the map tree throws after mount.
 */
export class CockpitErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message ?? String(error),
      stack: error?.stack ?? "",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[CRASH REASON]:", error, info);
    console.error("[CRASH REASON] componentStack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full min-h-[400px] w-full flex-col items-center justify-center gap-3 bg-[#0A192F] px-4 text-center">
          <p className="text-sm text-slate-300">Harita yüklenemedi. SOS barı kullanılabilir durumda.</p>
          <p className="max-w-lg break-words font-mono text-[11px] text-rose-300/90">
            {this.state.message || "Unknown error"}
          </p>
          {this.state.stack ? (
            <pre className="max-h-40 max-w-lg overflow-auto rounded-lg border border-white/10 bg-black/40 p-2 text-left text-[9px] leading-snug text-white/50">
              {this.state.stack}
            </pre>
          ) : null}
          <button
            type="button"
            className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-100"
            onClick={() => this.setState({ hasError: false, message: "", stack: "" })}
          >
            Haritayı yeniden dene
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
