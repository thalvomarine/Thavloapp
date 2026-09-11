/**
 * Visibility graph + A* over the Aegean coastal waypoint mesh.
 */

import {
  haversineNm,
  pathLengthNm,
  segmentCrossesLand,
  simplifyPath,
  type LatLng,
} from "./geometry.ts";
import { AEGEAN_LAND_MASKS } from "./land-masks.ts";
import { getSeaWaypoints } from "./waypoints.ts";

/** Max edge length when linking mesh nodes (keeps local corridors). */
const MAX_EDGE_NM = 4.8;
/** How far start/end may snap to the mesh. */
const SNAP_NM = 6.5;
/** Neighbour probe radius² in deg² (~MAX_EDGE_NM at this latitude). */
const DEG_PROBE = 0.09;

type Graph = {
  nodes: LatLng[];
  /** adjacency: nodeIndex → [{ to, costNm }] */
  adj: Array<Array<{ to: number; cost: number }>>;
};

let graphCache: Graph | null = null;

function buildGraph(): Graph {
  const nodes = getSeaWaypoints();
  const adj: Graph["adj"] = nodes.map(() => []);

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]!;
      const dLat = a.lat - b.lat;
      const dLng = a.lng - b.lng;
      if (dLat * dLat + dLng * dLng > DEG_PROBE) continue;
      const cost = haversineNm(a.lat, a.lng, b.lat, b.lng);
      if (cost > MAX_EDGE_NM || cost < 0.05) continue;
      if (segmentCrossesLand(a, b, AEGEAN_LAND_MASKS)) continue;
      adj[i]!.push({ to: j, cost });
      adj[j]!.push({ to: i, cost });
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
    const n = nodes[i]!;
    const cost = haversineNm(p.lat, p.lng, n.lat, n.lng);
    if (cost > maxNm) continue;
    if (!segmentCrossesLand(p, n, AEGEAN_LAND_MASKS)) clear.push({ idx: i, cost });
    else if (cost <= 2.2) soft.push({ idx: i, cost }); // marina / pocket exit hop
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
  const goal = nodes[goalIdx]!;
  const open = new Set<number>([startIdx]);
  const came = new Map<number, number>();
  const g = new Map<number, number>([[startIdx, 0]]);
  const f = new Map<number, number>([
    [startIdx, haversineNm(nodes[startIdx]!.lat, nodes[startIdx]!.lng, goal.lat, goal.lng)],
  ]);

  while (open.size > 0) {
    let current = -1;
    let best = Infinity;
    for (const idx of open) {
      const score = f.get(idx) ?? Infinity;
      if (score < best) {
        best = score;
        current = idx;
      }
    }
    if (current < 0) break;
    if (current === goalIdx) {
      const path = [current];
      while (came.has(path[0]!)) path.unshift(came.get(path[0]!)!);
      return path;
    }
    open.delete(current);
    const gCur = g.get(current) ?? Infinity;
    for (const edge of adj[current] ?? []) {
      const tentative = gCur + edge.cost;
      if (tentative >= (g.get(edge.to) ?? Infinity)) continue;
      came.set(edge.to, current);
      g.set(edge.to, tentative);
      const n = nodes[edge.to]!;
      f.set(edge.to, tentative + haversineNm(n.lat, n.lng, goal.lat, goal.lng));
      open.add(edge.to);
    }
  }
  return null;
}

/**
 * Multi-source A*: try a few nearest clear mesh anchors for start/goal.
 */
function routeViaMesh(from: LatLng, to: LatLng): LatLng[] | null {
  const starts = nearestNodes(from, 4, SNAP_NM);
  const goals = nearestNodes(to, 4, SNAP_NM);
  if (starts.length === 0 || goals.length === 0) return null;

  let best: { path: number[]; cost: number } | null = null;

  for (const s of starts) {
    for (const g of goals) {
      if (s.idx === g.idx) {
        const cost = s.cost + g.cost;
        if (!best || cost < best.cost) best = { path: [s.idx], cost };
        continue;
      }
      const p = astar(s.idx, g.idx);
      if (!p) continue;
      let meshCost = 0;
      const { nodes } = getGraph();
      for (let i = 1; i < p.length; i++) {
        const a = nodes[p[i - 1]!]!;
        const b = nodes[p[i]!]!;
        meshCost += haversineNm(a.lat, a.lng, b.lat, b.lng);
      }
      const total = s.cost + meshCost + g.cost;
      if (!best || total < best.cost) best = { path: p, cost: total };
    }
  }

  if (!best) return null;
  return best.path.map((i) => getGraph().nodes[i]!);
}

export type SeaRouteMode = "sea" | "direct";

export interface SeaRouteResult {
  waypoints: LatLng[];
  distanceNm: number;
  etaMinutes: number | null;
  speedKts: number;
  mode: SeaRouteMode;
}

/** Typical motor-sailer / cruising yacht SOG for cockpit ETA. */
export const DEFAULT_YACHT_SPEED_KTS = 7;

export function etaMinutesForNm(distanceNm: number, speedKts: number): number | null {
  if (!Number.isFinite(distanceNm) || !Number.isFinite(speedKts) || speedKts <= 0) return null;
  return (distanceNm / speedKts) * 60;
}

/**
 * Coastal sea route between two chart positions.
 * Prefers open-water mesh A*; falls back to a land-clear direct line when safe.
 */
export function computeSeaRoute(
  from: LatLng,
  to: LatLng,
  speedKts: number = DEFAULT_YACHT_SPEED_KTS,
): SeaRouteResult {
  const directNm = haversineNm(from.lat, from.lng, to.lat, to.lng);

  if (directNm < 0.12) {
    return {
      waypoints: [from, to],
      distanceNm: directNm,
      etaMinutes: etaMinutesForNm(directNm, speedKts),
      speedKts,
      mode: "direct",
    };
  }

  const directClear = !segmentCrossesLand(from, to, AEGEAN_LAND_MASKS);
  if (directClear && directNm <= 3.5) {
    return {
      waypoints: [from, to],
      distanceNm: directNm,
      etaMinutes: etaMinutesForNm(directNm, speedKts),
      speedKts,
      mode: "direct",
    };
  }

  const mesh = routeViaMesh(from, to);
  if (mesh && mesh.length > 0) {
    const raw = [from, ...mesh, to];
    const waypoints = simplifyPath(raw, 0.06);
    let clean = true;
    for (let i = 1; i < waypoints.length; i++) {
      const a = waypoints[i - 1]!;
      const b = waypoints[i]!;
      const isHarborHop = i === 1 || i === waypoints.length - 1;
      if (segmentCrossesLand(a, b, AEGEAN_LAND_MASKS)) {
        // Allow a short dock→fairway hop through oversized land masks.
        if (!(isHarborHop && haversineNm(a.lat, a.lng, b.lat, b.lng) <= 2.2)) {
          clean = false;
          break;
        }
      }
    }
    if (clean) {
      const distanceNm = pathLengthNm(waypoints);
      return {
        waypoints,
        distanceNm,
        etaMinutes: etaMinutesForNm(distanceNm, speedKts),
        speedKts,
        mode: "sea",
      };
    }
  }

  // Last resort: open-water southern gate chain (south of Datça).
  const midLng = (from.lng + to.lng) / 2;
  const gates: LatLng[] = [
    { lat: 36.58, lng: from.lng },
    { lat: 36.56, lng: midLng },
    { lat: 36.58, lng: to.lng },
  ];
  const via = [from, ...gates, to];
  let viaOk = true;
  for (let i = 1; i < via.length; i++) {
    if (segmentCrossesLand(via[i - 1]!, via[i]!, AEGEAN_LAND_MASKS)) {
      viaOk = false;
      break;
    }
  }
  if (viaOk) {
    const distanceNm = pathLengthNm(via);
    return {
      waypoints: via,
      distanceNm,
      etaMinutes: etaMinutesForNm(distanceNm, speedKts),
      speedKts,
      mode: "sea",
    };
  }

  if (directClear) {
    return {
      waypoints: [from, to],
      distanceNm: directNm,
      etaMinutes: etaMinutesForNm(directNm, speedKts),
      speedKts,
      mode: "direct",
    };
  }

  // Absolute fallback — still draw something (UI can warn later).
  return {
    waypoints: [from, to],
    distanceNm: directNm,
    etaMinutes: etaMinutesForNm(directNm, speedKts),
    speedKts,
    mode: "direct",
  };
}

/** @internal */
export function __resetSeaGraphCache() {
  graphCache = null;
}
