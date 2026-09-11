import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeNext } from "./nav.ts";

test("sanitizeNext accepts same-origin relative paths", () => {
  assert.equal(sanitizeNext("/app/job/abc"), "/app/job/abc");
  assert.equal(sanitizeNext("/app/shop?tab=cart"), "/app/shop?tab=cart");
});

test("sanitizeNext rejects off-origin and malformed values", () => {
  assert.equal(sanitizeNext("//evil.com"), undefined);
  assert.equal(sanitizeNext("https://evil.com"), undefined);
  assert.equal(sanitizeNext("http://x"), undefined);
  assert.equal(sanitizeNext("app/shop"), undefined);
  assert.equal(sanitizeNext(""), undefined);
  assert.equal(sanitizeNext(null), undefined);
  assert.equal(sanitizeNext(undefined), undefined);
  assert.equal(sanitizeNext(42), undefined);
  assert.equal(sanitizeNext({ next: "/app" }), undefined);
  assert.equal(sanitizeNext("/auth"), undefined);
  assert.equal(sanitizeNext("/index.html"), undefined);
  assert.equal(sanitizeNext("/index.htm"), undefined);
});
