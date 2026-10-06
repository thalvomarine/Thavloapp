import assert from "node:assert/strict";
import test from "node:test";
import { computeTrust } from "./trust.ts";

test("arrival is not invented from the star rating", () => {
  const report = computeTrust({ rating: 5, jobsCompleted: 12, verified: false });
  const arrival = report.metrics.find((m) => m.key === "arrival");
  assert.equal(arrival?.score, null);
});

test("timed arrivals, response, disputes and identity use their own records", () => {
  const report = computeTrust({
    rating: 4,
    jobsCompleted: 8,
    verified: true,
    arrivalOnTimeRatio: 0.75,
    arrivalSamples: 4,
    medianResponseMinutes: 18,
    responseSamples: 6,
    disputeCount: 1,
    completedJobs: 8,
  });
  const byKey = Object.fromEntries(report.metrics.map((m) => [m.key, m.score]));
  assert.equal(byKey.arrival, 75);
  assert.equal(byKey.response, 95);
  assert.equal(byKey.dispute, 88);
  assert.equal(byKey.verified, 100);
});

test("a clean completed record is a real dispute score, not a placeholder", () => {
  const report = computeTrust({
    rating: null,
    jobsCompleted: 3,
    disputeCount: 0,
    completedJobs: 3,
  });
  const dispute = report.metrics.find((m) => m.key === "dispute");
  assert.equal(dispute?.score, 100);
  assert.equal(dispute?.placeholder, false);
});
