/**
 * Cockpit rasters shared with the public coverage chart.
 * Esri World Imagery plus an OpenSeaMap seamark overlay.
 */
export const MARINE_DARK_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** Public chart base. Dark gray keeps the sea from rendering as a bright blue tile. */
export const MARINE_PUBLIC_BASE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";

export const MARINE_SEAMARK_TILE_URL = "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png";

export const MARINE_DARK_TILE_MAX_NATIVE_ZOOM = 18;
