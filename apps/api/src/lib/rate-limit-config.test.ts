import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getRateLimitConfig } from "./rate-limit-config.js";

const originalEnv = {
  max: process.env.RATE_LIMIT_MAX,
  window: process.env.RATE_LIMIT_WINDOW
};

function restoreEnv() {
  setEnv("RATE_LIMIT_MAX", originalEnv.max);
  setEnv("RATE_LIMIT_WINDOW", originalEnv.window);
}

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("getRateLimitConfig", () => {
  afterEach(restoreEnv);

  it("returns defaults when env vars are missing", () => {
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW;

    assert.deepEqual(getRateLimitConfig(), {
      max: 120,
      timeWindow: "1 minute"
    });
  });

  it("defaults RATE_LIMIT_MAX for blank, invalid, zero, negative, and sub-1 values", () => {
    for (const value of ["", "   ", "not-a-number", "NaN", "0", "-10", "-1.5", "0.5"]) {
      process.env.RATE_LIMIT_MAX = value;

      assert.equal(getRateLimitConfig().max, 120, `RATE_LIMIT_MAX=${JSON.stringify(value)}`);
    }
  });

  it("accepts and normalizes valid RATE_LIMIT_MAX values", () => {
    process.env.RATE_LIMIT_MAX = "60";
    assert.equal(getRateLimitConfig().max, 60);

    process.env.RATE_LIMIT_MAX = "  90  ";
    assert.equal(getRateLimitConfig().max, 90);

    process.env.RATE_LIMIT_MAX = "100.7";
    assert.equal(getRateLimitConfig().max, 100);
  });

  it("defaults RATE_LIMIT_WINDOW for blank or missing values", () => {
    delete process.env.RATE_LIMIT_WINDOW;
    assert.equal(getRateLimitConfig().timeWindow, "1 minute");

    process.env.RATE_LIMIT_WINDOW = "";
    assert.equal(getRateLimitConfig().timeWindow, "1 minute");

    process.env.RATE_LIMIT_WINDOW = "   \t  ";
    assert.equal(getRateLimitConfig().timeWindow, "1 minute");
  });

  it("trims valid RATE_LIMIT_WINDOW values", () => {
    process.env.RATE_LIMIT_WINDOW = "  30 seconds  ";

    assert.equal(getRateLimitConfig().timeWindow, "30 seconds");
  });

  it("returns valid values when both env vars are set", () => {
    process.env.RATE_LIMIT_MAX = "200";
    process.env.RATE_LIMIT_WINDOW = "2 minutes";

    assert.deepEqual(getRateLimitConfig(), {
      max: 200,
      timeWindow: "2 minutes"
    });
  });
});
