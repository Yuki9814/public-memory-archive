import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { resolveLogLevel } from "./log-level.js";

const originalLogLevel = process.env.LOG_LEVEL;

function restoreEnv() {
  if (originalLogLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLogLevel;
  }
}

describe("resolveLogLevel", () => {
  afterEach(restoreEnv);

  it("returns info for missing, blank, and whitespace-only values", () => {
    for (const value of [undefined, "", "   ", " \t\n ", "\t", "  \r\n  "]) {
      if (value === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = value;
      }

      assert.equal(resolveLogLevel(process.env.LOG_LEVEL), "info", `LOG_LEVEL=${JSON.stringify(value)}`);
    }
  });

  it("trims leading and trailing whitespace from configured values", () => {
    for (const [raw, expected] of [
      ["  debug  ", "debug"],
      ["\ttrace\t", "trace"],
      ["  warn\n", "warn"],
      ["silent", "silent"]
    ] as const) {
      assert.equal(resolveLogLevel(raw), expected);
    }
  });

  it("preserves case and non-standard values", () => {
    assert.equal(resolveLogLevel("DEBUG"), "DEBUG");
    assert.equal(resolveLogLevel("  FooBar  "), "FooBar");
    assert.equal(resolveLogLevel("verbose"), "verbose");
  });
});
