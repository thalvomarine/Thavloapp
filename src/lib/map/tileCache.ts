/**
 * Offline map tile cache (Cache Storage) + corridor prefetch + Leaflet wrapper.
 */

import L from "leaflet";
import {
  AEGEAN_OFFLINE_BOUNDS,
  TILE_CACHE_NAME,
  countTilesForArea,
  latLngToTile,
  tileTemplateUrl,
  type TileBounds,
} from "./tile-math.ts";

export {
  AEGEAN_OFFLINE_BOUNDS,
  TILE_CACHE_NAME,
  countTilesForArea,
  latLngToTile,
  type TileBounds,
};

export type DownloadProgress = {
  done: number;
  total: number;
  percent: number;
  cancelled?: boolean;
};

async function openTileCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(TILE_CACHE_NAME);
  } catch (err) {
    console.warn("[TileCache] open failed:", err);
    return null;
  }
}

/** Fetch a tile into cache; returns true on success. */
export async function cacheTileUrl(url: string): Promise<boolean> {
  const cache = await openTileCache();
  if (!cache) return false;
  try {
    const hit = await cache.match(url);
    if (hit) return true;
    if (typeof navigator !== "undefined" && !navigator.onLine) return false;
    const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "reload" });
    if (!res.ok) return false;
    await cache.put(url, res.clone());
    return true;
  } catch (err) {
    console.warn("[TileCache] cache put failed:", url, err);
    return false;
  }
}

/**
 * Resolve a displayable tile URL: prefer Cache Storage, else network
 * (and write-through), else throw for Leaflet error tile.
 */
export async function resolveTileSrc(url: string): Promise<string> {
  const cache = await openTileCache();
  if (cache) {
    try {
      const hit = await cache.match(url);
      if (hit) {
        const blob = await hit.blob();
        return URL.createObjectURL(blob);
      }
    } catch {
      /* fall through */
    }
  }

  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  if (offline) {
    throw new Error("[TileCache] offline miss");
  }

  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (cache) {
      try {
        await cache.put(url, res.clone());
      } catch {
        /* quota — still show the tile */
      }
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    if (cache) {
      const hit = await cache.match(url);
      if (hit) {
        console.log("[TileCache] Offline Hit (fallback)");
        return URL.createObjectURL(await hit.blob());
      }
    }
    throw err;
  }
}

type CachedTileLayer = L.TileLayer & {
  _thalvoRevoke?: Set<string>;
};

/**
 * Leaflet TileLayer that reads/writes Cache Storage for each tile URL.
 */
export function createCachedTileLayer(
  urlTemplate: string,
  options: L.TileLayerOptions = {},
): L.TileLayer {
  const CachedLayer = L.TileLayer.extend({
    createTile(this: CachedTileLayer, coords: L.Coords, done: L.DoneCallback) {
      const tile = document.createElement("img");
      tile.alt = "";
      tile.setAttribute("role", "presentation");
      L.DomEvent.disableClickPropagation(tile);

      const url = this.getTileUrl(coords);
      let objectUrl: string | null = null;
      const online = typeof navigator === "undefined" || navigator.onLine;

      const finishOk = () => {
        done(undefined, tile);
      };
      const finishErr = (err: Error) => {
        if (this.options.errorTileUrl) {
          tile.src = this.options.errorTileUrl;
        }
        done(err, tile);
      };

      if (online) {
        tile.onload = () => finishOk();
        tile.onerror = () => finishErr(new Error("tile load error"));
        tile.src = url;
        return tile;
      }

      void resolveTileSrc(url)
        .then((src) => {
          objectUrl = src.startsWith("blob:") ? src : null;
          if (objectUrl) {
            if (!this._thalvoRevoke) this._thalvoRevoke = new Set();
            this._thalvoRevoke.add(objectUrl);
          }
          tile.onload = () => {
            finishOk();
          };
          tile.onerror = () => {
            if (objectUrl) {
              try {
                URL.revokeObjectURL(objectUrl);
                this._thalvoRevoke?.delete(objectUrl);
              } catch {
                /* ignore */
              }
            }
            finishErr(new Error("tile load error"));
          };
          tile.src = src;
        })
        .catch((err) => {
          finishErr(err instanceof Error ? err : new Error(String(err)));
        });

      return tile;
    },

    onRemove(this: CachedTileLayer, map: L.Map) {
      if (this._thalvoRevoke) {
        for (const u of this._thalvoRevoke) {
          try {
            URL.revokeObjectURL(u);
          } catch {
            /* ignore */
          }
        }
        this._thalvoRevoke.clear();
      }
      // @ts-expect-error Leaflet internal chain
      L.TileLayer.prototype.onRemove.call(this, map);
    },
  }) as typeof L.TileLayer;

  return new CachedLayer(urlTemplate, options);
}

export type PrefetchController = {
  cancel: () => void;
  promise: Promise<DownloadProgress>;
};

/**
 * Background-download tiles for a bounding box into Cache Storage.
 */
export function downloadAreaTiles(
  urlTemplate: string,
  bounds: TileBounds = AEGEAN_OFFLINE_BOUNDS,
  minZoom = 9,
  maxZoom = 15,
  onProgress?: (p: DownloadProgress) => void,
): PrefetchController {
  let cancelled = false;
  const total = countTilesForArea(bounds, minZoom, maxZoom);
  let done = 0;

  const report = () => {
    onProgress?.({
      done,
      total,
      percent: total === 0 ? 100 : Math.min(100, Math.round((done / total) * 100)),
      cancelled,
    });
  };

  const urls: string[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const sw = latLngToTile(bounds.south, bounds.west, z);
    const ne = latLngToTile(bounds.north, bounds.east, z);
    const x0 = Math.min(sw.x, ne.x);
    const x1 = Math.max(sw.x, ne.x);
    const y0 = Math.min(sw.y, ne.y);
    const y1 = Math.max(sw.y, ne.y);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        urls.push(tileTemplateUrl(urlTemplate, z, x, y));
      }
    }
  }

  const CONCURRENCY = 4;

  const promise = (async (): Promise<DownloadProgress> => {
    report();
    let idx = 0;
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (!cancelled && idx < urls.length) {
        const i = idx++;
        const url = urls[i]!;
        await cacheTileUrl(url);
        done += 1;
        if (done % 8 === 0 || done === total) report();
      }
    });
    await Promise.all(workers);
    const final: DownloadProgress = {
      done,
      total,
      percent: total === 0 ? 100 : Math.min(100, Math.round((done / total) * 100)),
      cancelled,
    };
    onProgress?.(final);
    console.log("[TileCache] Prefetch complete", final);
    return final;
  })();

  return {
    cancel: () => {
      cancelled = true;
      console.log("[TileCache] Prefetch cancelled");
    },
    promise,
  };
}
