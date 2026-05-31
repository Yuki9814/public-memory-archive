import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isConfiguredWaybackEnabled, isWaybackEnabled } from "./wayback-config.js";

const originalEnv = process.env.ENABLE_WAYBACK;

function restoreEnv() {
  if (originalEnv === undefined) {
    delete process.env.ENABLE_WAYBACK;
  } else {
    process.env.ENABLE_WAYBACK = originalEnv;
  }
}

describe("isWaybackEnabled", () => {
  afterEach(restoreEnv);

  it("returns false for missing, blank, and whitespace-only values", () => {
    for (const value of [undefined, "", "   ", "\t\n  ", "\r\n\t  "]) {
      if (value === undefined) {
        delete process.env.ENABLE_WAYBACK;
      } else {
        process.env.ENABLE_WAYBACK = value;
      }

      assert.equal(isConfiguredWaybackEnabled(), false, `value=${JSON.stringify(value)}`);
    }
  });

  it("returns false for non-true explicit values", () => {
    for (const value of ["false", "1", "yes", "0", "on", "TRUE", "True", "trueX", "tr ue"]) {
      process.env.ENABLE_WAYBACK = value;

      assert.equal(isConfiguredWaybackEnabled(), false, `value=${JSON.stringify(value)}`);
    }
  });

  it("returns true only for exact true after trimming surrounding whitespace", () => {
    for (const value of ["true", "  true  ", "\n\ttrue\r\n", " true ", "true\n"]) {
      process.env.ENABLE_WAYBACK = value;

      assert.equal(isConfiguredWaybackEnabled(), true, `value=${JSON.stringify(value)}`);
    }
  });

  it("supports direct pure calls without reading process.env", () => {
    process.env.ENABLE_WAYBACK = "true";

    assert.equal(isWaybackEnabled(undefined), false);
    assert.equal(isWaybackEnabled("  true\t"), true);
    assert.equal(isWaybackEnabled("TRUE"), false);
    assert.equal(isWaybackEnabled("false"), false);
  });
});
