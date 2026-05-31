import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getStorageLocalDir } from "./storage-config.js";

const originalEnv = process.env.STORAGE_LOCAL_DIR;

function restoreEnv() {
  if (originalEnv === undefined) {
    delete process.env.STORAGE_LOCAL_DIR;
  } else {
    process.env.STORAGE_LOCAL_DIR = originalEnv;
  }
}

describe("getStorageLocalDir", () => {
  afterEach(restoreEnv);

  it("defaults missing, blank, and whitespace-only STORAGE_LOCAL_DIR values", () => {
    for (const value of [undefined, "", "   ", "\t\n  ", "\r\n\t  "]) {
      if (value === undefined) {
        delete process.env.STORAGE_LOCAL_DIR;
      } else {
        process.env.STORAGE_LOCAL_DIR = value;
      }

      assert.equal(getStorageLocalDir(), "./storage/captures", `value=${JSON.stringify(value)}`);
    }
  });

  it("trims and returns configured STORAGE_LOCAL_DIR values", () => {
    for (const [value, expected] of [
      ["./data", "./data"],
      ["  /tmp/captures  ", "/tmp/captures"],
      ["\n\t./storage/archive\r\n", "./storage/archive"],
      ["/var/lib/memory-archive", "/var/lib/memory-archive"]
    ] as const) {
      process.env.STORAGE_LOCAL_DIR = value;

      assert.equal(getStorageLocalDir(), expected, `value=${JSON.stringify(value)}`);
    }
  });
});
