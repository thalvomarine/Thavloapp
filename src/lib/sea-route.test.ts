import test from "node:test";
import assert from "node:assert/strict";
import { computeSeaRoute, __resetSeaGraphCache } from "./sea-route/index.ts";
import { __resetSeaWaypointsCache } from "./sea-route/waypoints.ts";
import { haversineNm, segmentCrossesLand } from "./sea-route/geometry.ts";
import { AEGEAN_LAND_MASKS } from "./sea-route/land-masks.ts";

function reset() {
  __resetSeaGraphCache();
  __resetSeaWaypointsCache();
}

test("sea route around Datça is longer than great-circle and avoids land legs", () => {
  reset();
  // Marmaris approaches → Göcek marina (straight line crosses Datça peninsula)
  const from = { lat: 36.84, lng: 28.28 };
  const to = { lat: 36.7525, lng: 28.9428 };
  const route = computeSeaRoute(from, to, 7);
  assert.ok(route.waypoints.length >= 3, "expected multi-leg sea path");
  assert.equal(route.mode, "sea");
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
});

test("short open-water hop stays direct", () => {
  reset();
  const from = { lat: 36.7525, lng: 28.9428 };
  const to = { lat: 36.748, lng: 28.938 };
  const route = computeSeaRoute(from, to, 7);
  assert.equal(route.mode, "direct");
  assert.equal(route.waypoints.length, 2);
  assert.ok(route.etaMinutes != null && route.etaMinutes > 0);
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
