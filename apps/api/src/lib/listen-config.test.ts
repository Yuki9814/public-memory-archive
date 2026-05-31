import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getApiListenConfig } from "./listen-config.js";

const originalEnv = {
  host: process.env.API_HOST,
  port: process.env.API_PORT
};

function restoreEnv() {
  setEnv("API_HOST", originalEnv.host);
  setEnv("API_PORT", originalEnv.port);
}

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("getApiListenConfig", () => {
  afterEach(restoreEnv);

  it("returns defaults when env vars are missing", () => {
    delete process.env.API_HOST;
    delete process.env.API_PORT;

    assert.deepEqual(getApiListenConfig(), {
      host: "0.0.0.0",
      port: 4100
    });
  });

  it("defaults API_PORT for blank, invalid, fractional, and out-of-range values", () => {
    for (const value of ["", "   ", "not-a-number", "NaN", "0", "-1", "4100.5", "65536", "70000"]) {
      process.env.API_PORT = value;

      assert.equal(getApiListenConfig().port, 4100, `API_PORT=${JSON.stringify(value)}`);
    }
  });

  it("accepts valid API_PORT values", () => {
    for (const [raw, expected] of [
      ["8080", 8080],
      ["  3000  ", 3000],
      ["1", 1],
      ["65535", 65535]
    ] as const) {
      process.env.API_PORT = raw;

      assert.equal(getApiListenConfig().port, expected);
    }
  });

  it("defaults API_HOST when blank or missing", () => {
    delete process.env.API_HOST;
    assert.equal(getApiListenConfig().host, "0.0.0.0");

    process.env.API_HOST = "";
    assert.equal(getApiListenConfig().host, "0.0.0.0");

    process.env.API_HOST = "   \t  ";
    assert.equal(getApiListenConfig().host, "0.0.0.0");
  });

  it("trims valid API_HOST values", () => {
    process.env.API_HOST = "  127.0.0.1  ";

    assert.equal(getApiListenConfig().host, "127.0.0.1");
  });

  it("returns valid values when both env vars are set", () => {
    process.env.API_HOST = "localhost";
    process.env.API_PORT = "5000";

    assert.deepEqual(getApiListenConfig(), {
      host: "localhost",
      port: 5000
    });
  });
});
