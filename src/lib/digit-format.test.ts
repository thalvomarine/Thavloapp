import assert from "node:assert/strict";
import test from "node:test";
import { groupCard, groupExpiry, groupMeasure, groupThousands, parseGrouped } from "./digit-format.ts";

test("thousands use dots", () => {
  assert.equal(groupThousands("285000"), "285.000");
  assert.equal(groupThousands("1.250.000"), "1.250.000");
  assert.equal(parseGrouped("1.250.000"), 1250000);
});

test("a short decimal stays a comma", () => {
  assert.equal(groupMeasure("12.5"), "12,5");
  assert.equal(groupMeasure("12,50"), "12,50");
  assert.equal(parseGrouped("12,5"), 12.5);
  assert.equal(groupMeasure("1.250"), "1.250");
});

test("card numbers split every four digits and expiry inserts a slash", () => {
  assert.equal(groupCard("4242424242424242"), "4242 4242 4242 4242");
  assert.equal(groupExpiry("1228"), "12/28");
  assert.equal(groupExpiry("12"), "12");
});
