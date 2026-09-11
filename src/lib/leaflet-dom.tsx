import { useEffect, useRef, type ReactNode } from "react";
import L from "leaflet";

/** Stop Leaflet drag/zoom from eating HUD clicks and wheel. */
export function LeafletPointerGuard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      onPointerDown={(event) => {
        event.stopPropagation();
        L.DomEvent.stopPropagation(event.nativeEvent);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        L.DomEvent.stopPropagation(event.nativeEvent);
      }}
    >
      {children}
    </div>
  );
}

export function stopMapEvent(event: { stopPropagation: () => void; nativeEvent?: Event }) {
  event.stopPropagation();
  const native = event.nativeEvent;
  if (native) L.DomEvent.stopPropagation(native);
}
