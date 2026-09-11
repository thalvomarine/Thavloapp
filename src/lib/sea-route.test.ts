import test from "node:test";
import assert from "node:assert/strict";
import {
  computeSeaRoute,
  computeSeaRouteVia,
  __resetSeaGraphCache,
} from "./sea-route/index.ts";
import { __resetSeaWaypointsCache } from "./sea-route/waypoints.ts";
import {
  expandRing,
  haversineNm,
  isFiniteLatLng,
  segmentCrossesLand,
} from "./sea-route/geometry.ts";
import { AEGEAN_LAND_MASKS, AEGEAN_LAND_MASKS_BUFFERED } from "./sea-route/land-masks.ts";
import { KURDOGLU_OFFSHORE } from "./sea-route/corridors.ts";
import { simplifySeaRoute } from "./sea-route/simplify-route.ts";
import { getSeaWaypoints } from "./sea-route/waypoints.ts";

function reset() {
  __resetSeaGraphCache();
  __resetSeaWaypointsCache();
}

test("sea route around Datça is longer than great-circle and avoids land legs", () => {
  reset();
  const from = { lat: 36.84, lng: 28.28 };
  const to = { lat: 36.7525, lng: 28.9428 };
  const route = computeSeaRoute(from, to, 7);
  assert.ok(route.waypoints.length >= 3, "expected multi-leg sea path");
  assert.equal(route.mode, "sea");
  assert.ok(route.legs.length >= 2);
  assert.ok(route.distanceNm > 25, `expected long coastal detour, got ${route.distanceNm}`);
  for (let i = 1; i < route.waypoints.length; i++) {
    const a = route.waypoints[i - 1]!;
    const b = route.waypoints[i]!;
    const isHarbor = i === 1 || i === route.waypoints.length - 1;
    const crosses = segmentCrossesLand(a, b, AEGEAN_LAND_MASKS);
    if (isHarbor && haversineNm(a.lat, a.lng, b.lat, b.lng) <= 2.5) continue;
    assert.equal(crosses, false, `leg ${i} crosses land`);
  }
});

test("Göcek to Köyceğiz is detected as land-crossing (not a straight clear hop)", () => {
  reset();
  const from = { lat: 36.7525, lng: 28.9428 };
  const to = { lat: 36.84, lng: 28.72 };
  assert.equal(segmentCrossesLand(from, to, AEGEAN_LAND_MASKS), true);
  assert.equal(segmentCrossesLand(from, to, AEGEAN_LAND_MASKS_BUFFERED), true);
  const route = computeSeaRoute(from, to, 7);
  assert.equal(route.mode, "sea");
  assert.ok(route.waypoints.length >= 3);
});

test("invalid coords never throw", () => {
  reset();
  const route = computeSeaRoute(
    { lat: Number.NaN, lng: 28 } as never,
    { lat: 36.7, lng: 28.9 },
    7,
  );
  assert.ok(Array.isArray(route.waypoints));
  assert.ok(Array.isArray(route.legs));
});

test("short open-water hop stays direct", () => {
  reset();
  // South of Datça — clear of buffered coastal masks
  const from = { lat: 36.58, lng: 28.15 };
  const to = { lat: 36.585, lng: 28.2 };
  const route = computeSeaRoute(from, to, 7);
  assert.equal(route.mode, "direct");
  assert.equal(route.waypoints.length, 2);
  assert.ok(route.etaMinutes != null && route.etaMinutes > 0);
  assert.equal(route.legs.length, 1);
});

test("Göcek bay route skirts Tersane island mass", () => {
  reset();
  const from = { lat: 36.7525, lng: 28.9428 };
  const to = { lat: 36.66, lng: 28.85 };
  const route = computeSeaRoute(from, to, 7);
  assert.ok(route.waypoints.length >= 2);
  for (let i = 1; i < route.waypoints.length; i++) {
    assert.equal(
      segmentCrossesLand(route.waypoints[i - 1]!, route.waypoints[i]!, AEGEAN_LAND_MASKS),
      false,
      `leg ${i} crosses land`,
    );
  }
});

test("buffered masks are larger than raw rings", () => {
  const raw = AEGEAN_LAND_MASKS[0]!;
  const buffered = expandRing(raw, 250);
  assert.equal(buffered.length, raw.length);
  // At least one vertex moved outward
  let moved = false;
  for (let i = 0; i < raw.length; i++) {
    if (Math.abs(buffered[i]!.lat - raw[i]!.lat) > 1e-6 || Math.abs(buffered[i]!.lng - raw[i]!.lng) > 1e-6) {
      moved = true;
      break;
    }
  }
  assert.equal(moved, true);
  assert.ok(AEGEAN_LAND_MASKS_BUFFERED.length === AEGEAN_LAND_MASKS.length);
});

test("Kurdoğlu corridor nodes are present in the mesh", () => {
  reset();
  const nodes = getSeaWaypoints();
  for (const c of KURDOGLU_OFFSHORE) {
    const near = nodes.some((n) => haversineNm(n.lat, n.lng, c.lat, c.lng) < 0.15);
    assert.ok(near, `expected Kurdoğlu node near ${c.lat},${c.lng}`);
  }
});

test("RDP simplify preserves LOS across land", () => {
  // Open-water track south of Datça (no land between samples)
  const zig: Array<{ lat: number; lng: number }> = [
    { lat: 36.58, lng: 28.0 },
    { lat: 36.575, lng: 28.05 },
    { lat: 36.57, lng: 28.1 },
    { lat: 36.575, lng: 28.15 },
    { lat: 36.58, lng: 28.2 },
  ];
  const simple = simplifySeaRoute(zig, AEGEAN_LAND_MASKS_BUFFERED, 0.05);
  assert.ok(simple.length >= 2);
  assert.ok(simple.length <= zig.length);
  for (let i = 1; i < simple.length; i++) {
    assert.equal(
      segmentCrossesLand(simple[i - 1]!, simple[i]!, AEGEAN_LAND_MASKS_BUFFERED),
      false,
      `simplified leg ${i} crosses buffered land`,
    );
  }
});

test("multi-via concatenate keeps finite waypoints", () => {
  reset();
  const origin = { lat: 36.7525, lng: 28.9428 };
  const via = { lat: 36.68, lng: 28.86 };
  const dest = { lat: 36.66, lng: 28.85 };
  const route = computeSeaRouteVia(origin, dest, [via], 8);
  assert.ok(route.waypoints.every(isFiniteLatLng));
  assert.ok(route.waypoints.length >= 2);
  assert.ok(route.legs.length >= 1);
});
