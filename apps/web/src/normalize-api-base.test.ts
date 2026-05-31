import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeApiBase } from "./normalize-api-base.js";

describe("normalizeApiBase", () => {
  it("returns empty string for missing, blank, and whitespace-only inputs", () => {
    for (const value of [undefined, null, "", "   ", "\t\n  ", "\r\n\t  "]) {
      assert.equal(normalizeApiBase(value), "", `value=${JSON.stringify(value)}`);
    }
  });

  it("trims valid bases and removes trailing slashes", () => {
    assert.equal(normalizeApiBase("  https://api.example.com  "), "https://api.example.com");
    assert.equal(normalizeApiBase("https://api.example.com/"), "https://api.example.com");
    assert.equal(normalizeApiBase("https://api.example.com/path//"), "https://api.example.com/path");
    assert.equal(normalizeApiBase("\n\t/api/v2/\r\n"), "/api/v2");
  });

  it("normalizes root-only bases to empty string for stable same-origin paths", () => {
    assert.equal(normalizeApiBase("/"), "");
    assert.equal(normalizeApiBase("  /  "), "");
    assert.equal(normalizeApiBase("///"), "");
  });

  it("preserves ports, path prefixes, and nonvalidated protocols", () => {
    assert.equal(normalizeApiBase("http://localhost:4100/"), "http://localhost:4100");
    assert.equal(normalizeApiBase("https://example.com/archive/"), "https://example.com/archive");
    assert.equal(normalizeApiBase("ftp://example.com/"), "ftp://example.com");
    assert.equal(normalizeApiBase("not a url/"), "not a url");
  });
});
