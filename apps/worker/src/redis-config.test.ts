import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getWorkerRedisUrl } from "./redis-config.js";

const originalEnv = process.env.REDIS_URL;

function restoreEnv() {
  if (originalEnv === undefined) {
    delete process.env.REDIS_URL;
  } else {
    process.env.REDIS_URL = originalEnv;
  }
}

describe("getWorkerRedisUrl", () => {
  afterEach(restoreEnv);

  it("defaults missing, blank, and whitespace-only REDIS_URL values", () => {
    for (const value of [undefined, "", "   ", "\t\n  ", "\r\n\t  "]) {
      if (value === undefined) {
        delete process.env.REDIS_URL;
      } else {
        process.env.REDIS_URL = value;
      }

      assert.equal(getWorkerRedisUrl(), "redis://localhost:6379", `value=${JSON.stringify(value)}`);
    }
  });

  it("trims and returns configured REDIS_URL values", () => {
    for (const [value, expected] of [
      ["redis://example.com:6379", "redis://example.com:6379"],
      ["  redis://example.com:6379  ", "redis://example.com:6379"],
      ["\n\tredis://prod:1234\r\n", "redis://prod:1234"],
      ["redis://user:pass@host:6379/0", "redis://user:pass@host:6379/0"]
    ] as const) {
      process.env.REDIS_URL = value;

      assert.equal(getWorkerRedisUrl(), expected, `value=${JSON.stringify(value)}`);
    }
  });
});
