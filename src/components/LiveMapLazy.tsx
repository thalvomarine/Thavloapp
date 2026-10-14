import { lazy, Suspense, type ComponentProps } from "react";
import { MapPlaceholder } from "@/components/ClientOnly";

const LiveMapEager = lazy(() =>
  import("@/components/LiveMap").then((m) => ({ default: m.LiveMap })),
);

export type { LiveAlert, LivePin } from "@/components/LiveMap";

type LiveMapProps = ComponentProps<typeof LiveMapEager>;

/** Code-split Leaflet chart — keeps non-map routes free of the map bundle. */
export function LiveMap(props: LiveMapProps) {
  const className =
    props && typeof props === "object" && "className" in props
      ? String((props as { className?: string }).className ?? "")
      : "";
  return (
    <Suspense fallback={<MapPlaceholder className={className} />}>
      <LiveMapEager {...props} />
    </Suspense>
  );
}
