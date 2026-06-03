import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildApp } from "../app.js";
import {
  getConfiguredCorsOrigin,
  isLocalhostOrigin,
  isOriginAllowed
} from "./cors-origin.js";

const originalEnv = {
  adminDisplayName: process.env.ADMIN_DISPLAY_NAME,
  adminPasscode: process.env.ADMIN_PASSCODE,
  adminSessionSecret: process.env.ADMIN_SESSION_SECRET,
  nodeEnv: process.env.NODE_ENV,
  publicSiteUrl: process.env.PUBLIC_SITE_URL
};

function restoreEnv() {
  setEnv("ADMIN_DISPLAY_NAME", originalEnv.adminDisplayName);
  setEnv("ADMIN_PASSCODE", originalEnv.adminPasscode);
  setEnv("ADMIN_SESSION_SECRET", originalEnv.adminSessionSecret);
  setEnv("NODE_ENV", originalEnv.nodeEnv);
  setEnv("PUBLIC_SITE_URL", originalEnv.publicSiteUrl);
}

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("CORS origin helper", () => {
  afterEach(restoreEnv);

  it("returns normalized PUBLIC_SITE_URL or default", () => {
    process.env.PUBLIC_SITE_URL = "https://example.com/";

    assert.equal(getConfiguredCorsOrigin(), "https://example.com");
  });

  it("detects localhost origins with optional ports", () => {
    assert.equal(isLocalhostOrigin("http://localhost"), true);
    assert.equal(isLocalhostOrigin("https://localhost:5173"), true);
    assert.equal(isLocalhostOrigin("http://127.0.0.1:3000"), true);
    assert.equal(isLocalhostOrigin("https://example.com"), false);
    assert.equal(isLocalhostOrigin("http://evil.localhost"), false);
  });

  it("allows missing Origin headers", () => {
    process.env.PUBLIC_SITE_URL = "https://archive.example.com";

    assert.equal(isOriginAllowed(undefined), true);
    assert.equal(isOriginAllowed(null), true);
    assert.equal(isOriginAllowed(""), true);
  });

  it("allows the exact configured origin", () => {
    process.env.PUBLIC_SITE_URL = "https://archive.example.com";

    assert.equal(isOriginAllowed("https://archive.example.com"), true);
    assert.equal(isOriginAllowed("https://archive.example.com/"), false);
  });

  it("uses only the origin when PUBLIC_SITE_URL includes a path prefix", () => {
    process.env.PUBLIC_SITE_URL = "https://example.com/archive/";

    assert.equal(getConfiguredCorsOrigin(), "https://example.com");
    assert.equal(isOriginAllowed("https://example.com"), true);
    assert.equal(isOriginAllowed("https://example.com/archive"), false);
  });

  it("allows localhost variants only when configured origin is local", () => {
    process.env.PUBLIC_SITE_URL = "http://localhost:5173";

    assert.equal(isOriginAllowed("http://localhost:3000"), true);
    assert.equal(isOriginAllowed("http://127.0.0.1:8080"), true);
    assert.equal(isOriginAllowed("https://localhost:8443"), true);

    process.env.PUBLIC_SITE_URL = "https://archive.example.com";
    assert.equal(isOriginAllowed("http://localhost:5173"), false);
  });

  it("disallows unrelated production origins", () => {
    process.env.PUBLIC_SITE_URL = "https://archive.example.com";

    assert.equal(isOriginAllowed("https://evil.example.net"), false);
  });

  it("falls back safely on malformed PUBLIC_SITE_URL", () => {
    process.env.PUBLIC_SITE_URL = "not a url";

    assert.equal(isOriginAllowed("http://localhost:9999"), true);
    assert.equal(isOriginAllowed("https://evil.example.net"), false);
  });

  it("fails closed when production PUBLIC_SITE_URL is missing or invalid", () => {
    process.env.NODE_ENV = "production";
    delete process.env.PUBLIC_SITE_URL;

    assert.throws(() => getConfiguredCorsOrigin(), /PUBLIC_SITE_URL is required in production/);
    assert.equal(isOriginAllowed("https://archive.example.com"), false);

    process.env.PUBLIC_SITE_URL = "http://localhost:5173";
    assert.throws(() => getConfiguredCorsOrigin(), /PUBLIC_SITE_URL must be a valid http\(s\) URL in production/);
    assert.equal(isOriginAllowed("http://localhost:5173"), false);

    process.env.PUBLIC_SITE_URL = "https://archive.example.com";
    assert.equal(isOriginAllowed("https://archive.example.com"), true);
    assert.equal(isOriginAllowed("http://localhost:5173"), false);
  });
});

describe("CORS integration", () => {
  beforeEach(() => {
    process.env.ADMIN_DISPLAY_NAME = "Admin";
    process.env.ADMIN_PASSCODE = "test-passcode";
    process.env.ADMIN_SESSION_SECRET = "test-secret";
  });

  afterEach(restoreEnv);

  type CorsMethod = "GET" | "OPTIONS";

  async function injectWithCors(options: {
    headers?: Record<string, string>;
    method?: CorsMethod;
    url?: string;
  }) {
    const app = await buildApp();
    try {
      const method: CorsMethod = options.method ?? "GET";
      return await app.inject({
        headers: options.headers ?? {},
        method,
        url: options.url ?? "/api/session"
      });
    } finally {
      await app.close();
    }
  }

  it("echoes the allowed public origin with credentials", async () => {
    process.env.PUBLIC_SITE_URL = "https://archive.example.com";

    const response = await injectWithCors({
      headers: { origin: "https://archive.example.com" }
    });

    assert.equal(response.headers["access-control-allow-origin"], "https://archive.example.com");
    assert.equal(response.headers["access-control-allow-credentials"], "true");
  });

  it("allows localhost preflight when configured origin is local", async () => {
    process.env.PUBLIC_SITE_URL = "http://localhost:5173";

    const response = await injectWithCors({
      method: "OPTIONS",
      headers: {
        "access-control-request-headers": "content-type",
        "access-control-request-method": "POST",
        origin: "http://localhost:3000"
      }
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers["access-control-allow-origin"], "http://localhost:3000");
    assert.ok(String(response.headers["access-control-allow-methods"]).includes("POST"));
  });

  it("does not echo a disallowed origin", async () => {
    process.env.PUBLIC_SITE_URL = "https://archive.example.com";

    const response = await injectWithCors({
      headers: { origin: "https://evil.example.net" }
    });

    assert.notEqual(response.headers["access-control-allow-origin"], "https://evil.example.net");
  });

  it("does not emit wildcard ACAO for missing Origin", async () => {
    process.env.PUBLIC_SITE_URL = "https://archive.example.com";

    const response = await injectWithCors({});

    assert.equal(response.statusCode, 200);
    assert.notEqual(response.headers["access-control-allow-origin"], "*");
  });

  it("refuses to start in production without an HTTPS public origin", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.PUBLIC_SITE_URL;

    await assert.rejects(() => buildApp(), /PUBLIC_SITE_URL is required in production/);

    process.env.PUBLIC_SITE_URL = "http://localhost:5173";
    await assert.rejects(() => buildApp(), /PUBLIC_SITE_URL must be a valid http\(s\) URL in production/);
  });
});
