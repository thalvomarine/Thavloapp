import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Renders `fallback` on the server and on the client's first paint, then
 * swaps to `children` after mount. Keeps SSR HTML identical to the hydrate
 * pass so Leaflet / `window` / `document` trees cannot throw React #418.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  if (!isMounted) return <>{fallback}</>;
  return <>{children}</>;
}

export function MapPlaceholder({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={
        "flex h-full min-h-[500px] w-full items-center justify-center bg-slate-900 text-slate-500 animate-pulse " +
        className
      }
      style={style}
      role="status"
      aria-live="polite"
    >
      Harita Yükleniyor...
    </div>
  );
}
