import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getPublicSiteOrigin, getPublicSiteUrl } from "./public-url.js";

describe("getPublicSiteUrl", () => {
  const originalEnv = process.env.PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PUBLIC_SITE_URL;
    } else {
      process.env.PUBLIC_SITE_URL = originalEnv;
    }
  });

  it("returns default when env is missing", () => {
    delete process.env.PUBLIC_SITE_URL;
    assert.equal(getPublicSiteUrl(), "http://localhost:5173");
  });

  it("returns default when env is blank after trimming", () => {
    process.env.PUBLIC_SITE_URL = "   ";
    assert.equal(getPublicSiteUrl(), "http://localhost:5173");
  });

  it("trims surrounding whitespace", () => {
    process.env.PUBLIC_SITE_URL = "  https://example.com  ";
    assert.equal(getPublicSiteUrl(), "https://example.com");
  });

  it("removes trailing slashes", () => {
    process.env.PUBLIC_SITE_URL = "https://example.com/";
    assert.equal(getPublicSiteUrl(), "https://example.com");
  });

  it("removes multiple trailing slashes", () => {
    process.env.PUBLIC_SITE_URL = "https://example.com///";
    assert.equal(getPublicSiteUrl(), "https://example.com");
  });

  it("handles whitespace and trailing slashes combined", () => {
    process.env.PUBLIC_SITE_URL = "  https://example.com//  ";
    assert.equal(getPublicSiteUrl(), "https://example.com");
  });

  it("preserves path prefix without trailing slash", () => {
    process.env.PUBLIC_SITE_URL = "https://example.com/archive/";
    assert.equal(getPublicSiteUrl(), "https://example.com/archive");
  });

  it("returns origin only for CORS even when PUBLIC_SITE_URL has a path prefix", () => {
    process.env.PUBLIC_SITE_URL = "https://example.com/archive/";
    assert.equal(getPublicSiteOrigin(), "https://example.com");
  });

  it("preserves port numbers", () => {
    process.env.PUBLIC_SITE_URL = "http://localhost:3000/";
    assert.equal(getPublicSiteUrl(), "http://localhost:3000");
  });

  it("returns default for unsupported protocols", () => {
    process.env.PUBLIC_SITE_URL = "ftp://example.com";
    assert.equal(getPublicSiteUrl(), "http://localhost:5173");
  });

  it("returns default for unsafe protocols", () => {
    process.env.PUBLIC_SITE_URL = "javascript:alert(1)";
    assert.equal(getPublicSiteUrl(), "http://localhost:5173");
  });

  it("returns default for malformed URLs", () => {
    process.env.PUBLIC_SITE_URL = "not-a-url";
    assert.equal(getPublicSiteUrl(), "http://localhost:5173");
  });
});
