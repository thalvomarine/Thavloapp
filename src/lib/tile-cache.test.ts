import test from "node:test";
import assert from "node:assert/strict";
import {
  AEGEAN_OFFLINE_BOUNDS,
  countTilesForArea,
  latLngToTile,
} from "./map/tile-math.ts";

test("latLngToTile is stable for Göcek at z=12", () => {
  const t = latLngToTile(36.7525, 28.9428, 12);
  assert.ok(Number.isInteger(t.x) && Number.isInteger(t.y));
  assert.ok(t.x >= 0 && t.y >= 0);
});

test("countTilesForArea grows with zoom span", () => {
  const narrow = countTilesForArea(AEGEAN_OFFLINE_BOUNDS, 9, 10);
  const wide = countTilesForArea(AEGEAN_OFFLINE_BOUNDS, 9, 12);
  assert.ok(narrow > 0);
  assert.ok(wide > narrow);
});

test("Aegean offline bounds are ordered", () => {
  assert.ok(AEGEAN_OFFLINE_BOUNDS.south < AEGEAN_OFFLINE_BOUNDS.north);
  assert.ok(AEGEAN_OFFLINE_BOUNDS.west < AEGEAN_OFFLINE_BOUNDS.east);
});
