import test from "node:test";
import assert from "node:assert/strict";
import { readCompleteJobResult } from "./payments.ts";

test("readCompleteJobResult recognises the two known statuses", () => {
  assert.equal(readCompleteJobResult({ status: "completed" }), "completed");
  assert.equal(readCompleteJobResult({ status: "already_completed" }), "already_completed");
});

test("readCompleteJobResult rejects unexpected shapes", () => {
  assert.equal(readCompleteJobResult(null), "unknown");
  assert.equal(readCompleteJobResult(undefined), "unknown");
  assert.equal(readCompleteJobResult({}), "unknown");
  assert.equal(readCompleteJobResult([]), "unknown");
  assert.equal(readCompleteJobResult("completed"), "unknown");
  assert.equal(readCompleteJobResult({ status: "weird" }), "unknown");
});
