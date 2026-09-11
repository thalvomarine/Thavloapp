import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Isolates chart / Leaflet failures from the mission dock so SOS stays
 * clickable even when the map tree throws after mount.
 */
export class CockpitErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[cockpit] subtree crashed", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full min-h-[400px] w-full items-center justify-center bg-slate-900 px-4 text-center text-sm text-slate-400">
            Harita yüklenemedi. SOS barı kullanılabilir durumda.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
