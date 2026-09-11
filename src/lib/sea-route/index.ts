/**
 * Visibility graph + A* over the Aegean coastal waypoint mesh.
 *
 * Hard rules:
 * - Never throw into React (mobile WebView → ErrorBoundary blue screen).
 * - Cap A* iterations / neighbour fan-out to avoid OOM.
 * - Coordinates are {lat,lng} only.
 */

import {
  haversineNm,
  isFiniteLatLng,
  pathLengthNm,
  segmentCrossesLand,
  simplifyPath,
  type LatLng,
} from "./geometry.ts";
import { AEGEAN_LAND_MASKS } from "./land-masks.ts";
import { getSeaWaypoints } from "./waypoints.ts";

const MAX_EDGE_NM = 5.5;
const SNAP_NM = 7;
/** Bucket size in degrees for neighbour lookup (~MAX_EDGE_NM). */
const BUCKET = 0.08;
const ASTAR_MAX_ITER = 8_000;
const NEAREST_LIMIT = 3;

type Graph = {
  nodes: LatLng[];
  adj: Array<Array<{ to: number; cost: number }>>;
};

let graphCache: Graph | null = null;

function bucketKey(lat: number, lng: number): string {
  return `${Math.floor(lat / BUCKET)}:${Math.floor(lng / BUCKET)}`;
}

function buildGraph(): Graph {
  const nodes = getSeaWaypoints();
  const adj: Graph["adj"] = nodes.map(() => []);
  const buckets = new Map<string, number[]>();

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    const key = bucketKey(n.lat, n.lng);
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!;
    const bi = Math.floor(a.lat / BUCKET);
    const bj = Math.floor(a.lng / BUCKET);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const cell = buckets.get(`${bi + di}:${bj + dj}`);
        if (!cell) continue;
        for (const j of cell) {
          if (j <= i) continue;
          const b = nodes[j]!;
          const cost = haversineNm(a.lat, a.lng, b.lat, b.lng);
          if (cost > MAX_EDGE_NM || cost < 0.05) continue;
          if (segmentCrossesLand(a, b, AEGEAN_LAND_MASKS, 8)) continue;
          adj[i]!.push({ to: j, cost });
          adj[j]!.push({ to: i, cost });
        }
      }
    }
  }
  return { nodes, adj };
}

function getGraph(): Graph {
  if (!graphCache) graphCache = buildGraph();
  return graphCache;
}

function nearestNodes(
  p: LatLng,
  limit: number,
  maxNm: number,
): Array<{ idx: number; cost: number }> {
  const { nodes } = getGraph();
  const clear: Array<{ idx: number; cost: number }> = [];
  const soft: Array<{ idx: number; cost: number }> = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n) continue;
    const cost = haversineNm(p.lat, p.lng, n.lat, n.lng);
    if (!Number.isFinite(cost) || cost > maxNm) continue;
    if (!segmentCrossesLand(p, n, AEGEAN_LAND_MASKS, 8)) clear.push({ idx: i, cost });
    else if (cost <= 2.5) soft.push({ idx: i, cost });
  }
  clear.sort((a, b) => a.cost - b.cost);
  if (clear.length >= limit) return clear.slice(0, limit);
  soft.sort((a, b) => a.cost - b.cost);
  const merged = [...clear];
  for (const s of soft) {
    if (merged.length >= limit) break;
    if (!merged.some((m) => m.idx === s.idx)) merged.push(s);
  }
  return merged;
}

function astar(startIdx: number, goalIdx: number): number[] | null {
  const { nodes, adj } = getGraph();
  if (
    startIdx < 0 ||
    goalIdx < 0 ||
    startIdx >= nodes.length ||
    goalIdx >= nodes.length ||
    !nodes[startIdx] ||
    !nodes[goalIdx]
  ) {
    return null;
  }
  const goal = nodes[goalIdx]!;
  const open = new Set<number>([startIdx]);
  const came = new Map<number, number>();
  const gScore = new Map<number, number>([[startIdx, 0]]);
  const fScore = new Map<number, number>([
    [startIdx, haversineNm(nodes[startIdx]!.lat, nodes[startIdx]!.lng, goal.lat, goal.lng)],
  ]);

  let iterations = 0;
  while (open.size > 0) {
    if (++iterations > ASTAR_MAX_ITER) {
      console.warn("[SeaRoute] A* aborted — maxIterations", ASTAR_MAX_ITER);
      return null;
    }
    let current = -1;
    let best = Infinity;
    for (const idx of open) {
      const score = fScore.get(idx) ?? Infinity;
      if (score < best) {
        best = score;
        current = idx;
      }
    }
    if (current < 0) break;
    if (current === goalIdx) {
      const path: number[] = [current];
      let guard = 0;
      while (came.has(path[0]!)) {
        if (++guard > ASTAR_MAX_ITER) break;
        path.unshift(came.get(path[0]!)!);
      }
      return path;
    }
    open.delete(current);
    const gCur = gScore.get(current) ?? Infinity;
    for (const edge of adj[current] ?? []) {
      if (edge.to < 0 || edge.to >= nodes.length || !nodes[edge.to]) continue;
      const tentative = gCur + edge.cost;
      if (tentative >= (gScore.get(edge.to) ?? Infinity)) continue;
      came.set(edge.to, current);
      gScore.set(edge.to, tentative);
      const n = nodes[edge.to]!;
      fScore.set(edge.to, tentative + haversineNm(n.lat, n.lng, goal.lat, goal.lng));
      open.add(edge.to);
    }
  }
  return null;
}

function routeViaMesh(from: LatLng, to: LatLng): LatLng[] | null {
  const starts = nearestNodes(from, NEAREST_LIMIT, SNAP_NM);
  const goals = nearestNodes(to, NEAREST_LIMIT, SNAP_NM);
  if (starts.length === 0 || goals.length === 0) return null;

  let best: { path: number[]; cost: number } | null = null;
  const { nodes } = getGraph();

  for (const s of starts) {
    for (const g of goals) {
      if (s.idx === g.idx) {
        const cost = s.cost + g.cost;
        if (!best || cost < best.cost) best = { path: [s.idx], cost };
        continue;
      }
      const p = astar(s.idx, g.idx);
      if (!p || p.length === 0) continue;
      let meshCost = 0;
      let valid = true;
      for (let i = 1; i < p.length; i++) {
        const a = nodes[p[i - 1]!];
        const b = nodes[p[i]!];
        if (!a || !b) {
          valid = false;
          break;
        }
        meshCost += haversineNm(a.lat, a.lng, b.lat, b.lng);
      }
      if (!valid) continue;
      const total = s.cost + meshCost + g.cost;
      if (!best || total < best.cost) best = { path: p, cost: total };
    }
  }

  if (!best) return null;
  const out: LatLng[] = [];
  for (const i of best.path) {
    const n = nodes[i];
    if (n) out.push(n);
  }
  return out.length > 0 ? out : null;
}

export type SeaRouteMode = "sea" | "direct";

export interface SeaRouteResult {
  waypoints: LatLng[];
  distanceNm: number;
  etaMinutes: number | null;
  speedKts: number;
  mode: SeaRouteMode;
}

export const DEFAULT_YACHT_SPEED_KTS = 7;

export function etaMinutesForNm(distanceNm: number, speedKts: number): number | null {
  if (!Number.isFinite(distanceNm) || !Number.isFinite(speedKts) || speedKts <= 0) return null;
  return (distanceNm / speedKts) * 60;
}

function directResult(from: LatLng, to: LatLng, speedKts: number): SeaRouteResult {
  const distanceNm = haversineNm(from.lat, from.lng, to.lat, to.lng);
  const safeNm = Number.isFinite(distanceNm) ? distanceNm : 0;
  return {
    waypoints: [from, to],
    distanceNm: safeNm,
    etaMinutes: etaMinutesForNm(safeNm, speedKts),
    speedKts,
    mode: "direct",
  };
}

function seaResult(waypoints: LatLng[], speedKts: number): SeaRouteResult {
  const distanceNm = pathLengthNm(waypoints);
  return {
    waypoints,
    distanceNm,
    etaMinutes: etaMinutesForNm(distanceNm, speedKts),
    speedKts,
    mode: "sea",
  };
}

/**
 * Coastal sea route between two chart positions.
 * Never throws — failures log and fall back to a great-circle line.
 */
export function computeSeaRoute(
  from: LatLng,
  to: LatLng,
  speedKts: number = DEFAULT_YACHT_SPEED_KTS,
): SeaRouteResult {
  try {
    if (!isFiniteLatLng(from) || !isFiniteLatLng(to)) {
      console.error("[SeaRoute Error]: invalid coordinates", { from, to });
      const safeFrom = isFiniteLatLng(from) ? from : { lat: 36.7525, lng: 28.9428 };
      const safeTo = isFiniteLatLng(to) ? to : safeFrom;
      return directResult(safeFrom, safeTo, speedKts);
    }

    const kts = Number.isFinite(speedKts) && speedKts > 0 ? speedKts : DEFAULT_YACHT_SPEED_KTS;
    const directNm = haversineNm(from.lat, from.lng, to.lat, to.lng);

    if (directNm < 0.12) return directResult(from, to, kts);

    const directClear = !segmentCrossesLand(from, to, AEGEAN_LAND_MASKS, 16);
    if (directClear && directNm <= 3.5) return directResult(from, to, kts);

    const mesh = routeViaMesh(from, to);
    if (mesh && mesh.length > 0) {
      const raw = [from, ...mesh, to];
      const waypoints = simplifyPath(raw, 0.06);
      let clean = true;
      for (let i = 1; i < waypoints.length; i++) {
        const a = waypoints[i - 1]!;
        const b = waypoints[i]!;
        const isHarborHop = i === 1 || i === waypoints.length - 1;
        if (segmentCrossesLand(a, b, AEGEAN_LAND_MASKS, 8)) {
          if (!(isHarborHop && haversineNm(a.lat, a.lng, b.lat, b.lng) <= 2.5)) {
            clean = false;
            break;
          }
        }
      }
      if (clean && waypoints.length >= 2) return seaResult(waypoints, kts);
    }

    // Open-water southern gate chain (south of Datça / coastal land).
    const midLng = (from.lng + to.lng) / 2;
    const gates: LatLng[] = [
      { lat: 36.58, lng: from.lng },
      { lat: 36.55, lng: midLng },
      { lat: 36.58, lng: to.lng },
    ];
    const via = [from, ...gates, to];
    let viaOk = true;
    for (let i = 1; i < via.length; i++) {
      if (segmentCrossesLand(via[i - 1]!, via[i]!, AEGEAN_LAND_MASKS, 10)) {
        viaOk = false;
        break;
      }
    }
    if (viaOk) return seaResult(via, kts);

    // Only accept a straight line when it is actually clear of land.
    if (directClear) return directResult(from, to, kts);

    // Land-crossing absolute fallback: still prefer southern gates even if a
    // gate leg clips a mask (better than cutting the peninsula mid-chart).
    console.warn("[SeaRoute] using soft southern detour — masks incomplete for this pair");
    return seaResult(via, kts);
  } catch (err) {
    console.error("[SeaRoute Error]:", err);
    if (isFiniteLatLng(from) && isFiniteLatLng(to)) return directResult(from, to, speedKts);
    return {
      waypoints: [],
      distanceNm: 0,
      etaMinutes: null,
      speedKts,
      mode: "direct",
    };
  }
}

/**
 * Yields to the event loop before the (possibly cold) graph build so the
 * WebView can paint the sheet / map first. Prefer this from UI code.
 */
export function computeSeaRouteAsync(
  from: LatLng,
  to: LatLng,
  speedKts: number = DEFAULT_YACHT_SPEED_KTS,
): Promise<SeaRouteResult> {
  return new Promise((resolve) => {
    const run = () => {
      try {
        resolve(computeSeaRoute(from, to, speedKts));
      } catch (err) {
        console.error("[SeaRoute Error]:", err);
        resolve(
          isFiniteLatLng(from) && isFiniteLatLng(to)
            ? directResult(from, to, speedKts)
            : { waypoints: [], distanceNm: 0, etaMinutes: null, speedKts, mode: "direct" },
        );
      }
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => run(), { timeout: 400 });
    } else {
      setTimeout(run, 0);
    }
  });
}

/** @internal */
export function __resetSeaGraphCache() {
  graphCache = null;
}
