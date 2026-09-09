import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidCoordinate,
  isStale,
  isLowAccuracy,
  coarsen,
  fixToJobFields,
  formatAccuracy,
  pickValidCoordinates,
  STALE_AFTER_MS,
  LOW_ACCURACY_M,
  type GeoFix,
} from "./geolocation.ts";

const gocek: GeoFix = { lat: 36.7522, lng: 28.9401, accuracy: 12.4, capturedAt: 1_700_000_000_000 };

test("isValidCoordinate accepts a real Göcek-range fix", () => {
  assert.equal(isValidCoordinate(gocek.lat, gocek.lng), true);
});

test("isValidCoordinate rejects broken inputs", () => {
  assert.equal(isValidCoordinate(Number.NaN, 28.9), false);
  assert.equal(isValidCoordinate(36.7, Number.POSITIVE_INFINITY), false);
  assert.equal(isValidCoordinate("36.7", 28.9), false);
  assert.equal(isValidCoordinate(36.7, null), false);
  assert.equal(isValidCoordinate(91, 28.9), false);
  assert.equal(isValidCoordinate(36.7, 181), false);
  assert.equal(isValidCoordinate(0.00005, 0.00005), false);
});

test("isStale", () => {
  const now = 2_000_000_000_000;
  assert.equal(isStale(null, now), true);
  assert.equal(isStale({ ...gocek, capturedAt: now - 1_000 }, now), false);
  assert.equal(isStale({ ...gocek, capturedAt: now - STALE_AFTER_MS - 1 }, now), true);
});

test("isLowAccuracy boundary", () => {
  assert.equal(isLowAccuracy(null), false);
  assert.equal(isLowAccuracy({ ...gocek, accuracy: LOW_ACCURACY_M }), false);
  assert.equal(isLowAccuracy({ ...gocek, accuracy: LOW_ACCURACY_M + 0.1 }), true);
});

test("coarsen rounds to a ~1 km grid", () => {
  assert.deepEqual(coarsen(36.7522, 28.9401), { lat: 36.75, lng: 28.94 });
  assert.deepEqual(coarsen(36.7578, 28.9456), { lat: 36.76, lng: 28.95 });
});

test("fixToJobFields rounds accuracy and emits ISO timestamp", () => {
  const fields = fixToJobFields(gocek);
  assert.equal(fields.lat, gocek.lat);
  assert.equal(fields.lng, gocek.lng);
  assert.equal(fields.location_accuracy_m, 12);
  assert.equal(fields.location_captured_at, new Date(gocek.capturedAt).toISOString());
  assert.equal(fixToJobFields({ ...gocek, accuracy: Number.NaN }).location_accuracy_m, null);
});

test("formatAccuracy", () => {
  assert.equal(formatAccuracy(null), "—");
  assert.equal(formatAccuracy({ ...gocek, accuracy: Number.NaN }), "—");
  assert.equal(formatAccuracy({ ...gocek, accuracy: 42.4 }), "±42 m");
  assert.equal(formatAccuracy({ ...gocek, accuracy: 2500 }), "±2.5 km");
});

test("pickValidCoordinates keeps a real Göcek-range row and preserves fields", () => {
  const rows = [{ id: "a", lat: 36.7522, lng: 28.9401, kind: "diver" }];
  const kept = pickValidCoordinates(rows);
  assert.equal(kept.length, 1);
  assert.deepEqual(kept[0], rows[0]);
});

test("pickValidCoordinates drops every invalid shape", () => {
  const rows = [
    { id: "null", lat: null, lng: 28.9 },
    { id: "undef", lat: 36.7, lng: undefined },
    { id: "normalized", lat: 0.42, lng: 0.63 },
    { id: "range-lat", lat: 91, lng: 28.9 },
    { id: "range-lng", lat: 36.7, lng: 181 },
    { id: "nan", lat: Number.NaN, lng: 28.9 },
    { id: "inf", lat: 36.7, lng: Number.POSITIVE_INFINITY },
    { id: "string", lat: "36.7", lng: "28.9" },
    { id: "null-island", lat: 0, lng: 0 },
  ];
  assert.deepEqual(pickValidCoordinates(rows), []);
});

test("pickValidCoordinates preserves input order and returns [] for []", () => {
  const rows = [
    { id: "1", lat: 36.75, lng: 28.94 },
    { id: "bad", lat: 0.5, lng: 0.5 },
    { id: "2", lat: 40.98, lng: 29.02 },
  ];
  assert.deepEqual(pickValidCoordinates(rows).map((r) => r.id), ["1", "2"]);
  assert.deepEqual(pickValidCoordinates([]), []);
});
