import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getCaptureConcurrency } from "./concurrency.js";

const originalEnv = process.env.CAPTURE_CONCURRENCY;

function restoreEnv() {
  if (originalEnv === undefined) {
    delete process.env.CAPTURE_CONCURRENCY;
  } else {
    process.env.CAPTURE_CONCURRENCY = originalEnv;
  }
}

describe("getCaptureConcurrency", () => {
  afterEach(restoreEnv);

  it("defaults missing, blank, invalid, zero, negative, and sub-1 values", () => {
    for (const value of [
      undefined,
      "",
      "   ",
      "\t\n  ",
      "not-a-number",
      "NaN",
      "Infinity",
      "-Infinity",
      "0",
      "-0",
      "-1",
      "-10.7",
      "0.5",
      "0.9"
    ]) {
      if (value === undefined) {
        delete process.env.CAPTURE_CONCURRENCY;
      } else {
        process.env.CAPTURE_CONCURRENCY = value;
      }

      assert.equal(getCaptureConcurrency(), 2, `value=${JSON.stringify(value)}`);
    }
  });

  it("accepts positive values and floors fractions", () => {
    for (const [value, expected] of [
      ["1", 1],
      ["1.1", 1],
      ["2.9", 2],
      ["3.0", 3],
      ["  10.999  ", 10],
      ["\n42\t", 42]
    ] as const) {
      process.env.CAPTURE_CONCURRENCY = value;

      assert.equal(getCaptureConcurrency(), expected, `value=${JSON.stringify(value)}`);
    }
  });
});
