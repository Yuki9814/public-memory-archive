import assert from "node:assert/strict";
import test from "node:test";
import { summarizeCaptureResults } from "./capture.js";

test("summarizeCaptureResults handles sources without URL targets", () => {
  const summary = summarizeCaptureResults([]);
  assert.equal(summary.status, "COMPLETED");
  assert.equal(summary.errorMessage, null);
  assert.deepEqual(summary.result, { captures: [], note: "No URL targets on source." });
});

test("summarizeCaptureResults marks full success as completed", () => {
  const summary = summarizeCaptureResults([{ captureId: "c1", ok: true, hash: "abc" }]);
  assert.equal(summary.status, "COMPLETED");
  assert.equal(summary.errorMessage, null);
  assert.equal(summary.result.captures.length, 1);
});

test("summarizeCaptureResults keeps partial failure completed", () => {
  const summary = summarizeCaptureResults([
    { captureId: "c1", ok: true },
    { captureId: "c2", ok: false, error: "HTTP 500" }
  ]);
  assert.equal(summary.status, "COMPLETED");
  assert.equal(summary.errorMessage, null);
});

test("summarizeCaptureResults marks total failure as failed", () => {
  const summary = summarizeCaptureResults([{ captureId: "c1", ok: false, error: "blocked" }]);
  assert.equal(summary.status, "FAILED");
  assert.equal(summary.errorMessage, "All capture targets failed.");
});
