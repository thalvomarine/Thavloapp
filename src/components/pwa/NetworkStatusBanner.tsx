import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useOnlineStatus } from "@/lib/pwa";

/**
 * Slim top-of-screen banner that surfaces offline / reconnected state.
 * Sits above every route. Auto-hides ~2.5s after reconnect. SSR-safe.
 */
export function NetworkStatusBanner() {
  const online = useOnlineStatus();
  const [everOffline, setEverOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!online) {
      setEverOffline(true);
      setShowReconnected(false);
      return;
    }
    if (everOffline) {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 2500);
      return () => clearTimeout(t);
    }
  }, [online, everOffline]);

  if (online && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 z-[90] flex justify-center pointer-events-none"
      style={{ top: "max(env(safe-area-inset-top), 0px)" }}
    >
      <div
        className={
          "pointer-events-auto mt-2 mx-3 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] " +
          "backdrop-blur-md border shadow-lg inline-flex items-center gap-2 " +
          (online
            ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-100"
            : "bg-amber-500/15 border-amber-400/40 text-amber-100")
        }
      >
        {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
        {online ? "Back online" : "Offline · working in view-only mode"}
      </div>
    </div>
  );
}
