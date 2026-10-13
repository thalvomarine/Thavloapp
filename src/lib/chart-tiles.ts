/**
 * Cockpit rasters shared with the public coverage chart.
 * Esri World Imagery / Dark Gray Base plus an OpenSeaMap seamark overlay.
 *
 * Night/dark mode must use a real dark basemap — never CSS `filter: invert()`
 * on OSM. WebKit (iOS Safari / Chrome) fails to composite filtered tiles under
 * the seamark overlay and paints only the chart void (solid navy).
 */
export const MARINE_DARK_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** Cockpit + public dark chart base. Dark gray keeps the sea from flashing bright blue. */
export const MARINE_PUBLIC_BASE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";

export const MARINE_SEAMARK_TILE_URL = "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png";

export const MARINE_DARK_TILE_MAX_NATIVE_ZOOM = 18;
