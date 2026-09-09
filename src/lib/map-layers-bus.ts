import type { ChartLayerKey } from "@/components/map/ChartHud";

export const THALVO_LAYER_FILTER_EVENT = "thalvo:filter-layer";

export interface LayerFilterRequest {
  layer: ChartLayerKey;
  enabled: boolean;
}

export function requestLayerFilter(layer: ChartLayerKey, enabled = true) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<LayerFilterRequest>(THALVO_LAYER_FILTER_EVENT, {
      detail: { layer, enabled },
    }),
  );
}
