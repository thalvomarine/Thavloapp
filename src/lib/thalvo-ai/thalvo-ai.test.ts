import test from "node:test";
import assert from "node:assert/strict";
import { classifySeaState } from "./sea-state.ts";
import { resolvePlatformRoute } from "./platform-routes.ts";

test("classifySeaState ranks thunderstorm above a light wind", () => {
  assert.equal(
    classifySeaState({ windSpeedKts: 8, windGustKts: null, waveHeightM: 0.4, weatherCode: 95 }),
    "storm",
  );
});

test("classifySeaState uses gale, caution, and calm bands", () => {
  assert.equal(classifySeaState({ windSpeedKts: 36, windGustKts: 20, waveHeightM: 1, weatherCode: 1 }), "gale");
  assert.equal(classifySeaState({ windSpeedKts: 12, windGustKts: null, waveHeightM: 1.8, weatherCode: 2 }), "caution");
  assert.equal(classifySeaState({ windSpeedKts: 10, windGustKts: 14, waveHeightM: 0.6, weatherCode: 0 }), "none");
});

test("resolvePlatformRoute accepts product aliases and rejects off-site targets", () => {
  assert.equal(resolvePlatformRoute("/escrow"), "/app/orders");
  assert.equal(resolvePlatformRoute("/support"), "/app/report");
  assert.equal(resolvePlatformRoute("/app/shop"), "/app/shop");
  assert.equal(resolvePlatformRoute("/app/shop/"), "/app/shop");
  assert.equal(resolvePlatformRoute("https://evil.example/app/shop"), null);
  assert.equal(resolvePlatformRoute("//evil.example"), null);
  assert.equal(resolvePlatformRoute("/app/job/../../admin"), null);
  assert.equal(resolvePlatformRoute("/app/job/secret"), null);
});
