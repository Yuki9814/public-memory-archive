import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  assertSafeCaptureUrl,
  isBlockedIp,
  readLimitedText,
  safeFetch
} from "./capture-safety.js";

const originalCaptureMaxBytes = process.env.CAPTURE_MAX_BYTES;

afterEach(() => {
  if (originalCaptureMaxBytes === undefined) {
    delete process.env.CAPTURE_MAX_BYTES;
  } else {
    process.env.CAPTURE_MAX_BYTES = originalCaptureMaxBytes;
  }
});

test("capture URL safety blocks loopback, private, link-local, metadata, and IPv4-mapped addresses", async () => {
  assert.equal(isBlockedIp("127.0.0.1"), true);
  assert.equal(isBlockedIp("10.0.0.5"), true);
  assert.equal(isBlockedIp("172.16.0.5"), true);
  assert.equal(isBlockedIp("192.168.1.2"), true);
  assert.equal(isBlockedIp("169.254.169.254"), true);
  assert.equal(isBlockedIp("::1"), true);
  assert.equal(isBlockedIp("::ffff:172.16.0.5"), true);
  assert.equal(isBlockedIp("93.184.216.34"), false);

  await assert.rejects(() => assertSafeCaptureUrl("http://127.0.0.1/admin"), /CAPTURE_URL_PRIVATE_IP_BLOCKED/);
  await assert.rejects(() => assertSafeCaptureUrl("http://169.254.169.254/latest/meta-data"), /CAPTURE_URL_PRIVATE_IP_BLOCKED/);
  await assert.rejects(() => assertSafeCaptureUrl("http://[::1]/admin"), /CAPTURE_URL_PRIVATE_IP_BLOCKED/);
  await assert.rejects(() => assertSafeCaptureUrl("ftp://example.com/file"), /CAPTURE_URL_SCHEME_BLOCKED/);
  await assert.rejects(() => assertSafeCaptureUrl("https://user:pass@example.com"), /CAPTURE_URL_CREDENTIALS_BLOCKED/);
  await assert.rejects(() => assertSafeCaptureUrl("https://93.184.216.34:22"), /CAPTURE_URL_PORT_BLOCKED/);
});

test("safeFetch validates every redirect target", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(null, {
      headers: { location: "http://127.0.0.1/admin" },
      status: 302
    })) as typeof fetch;

  try {
    await assert.rejects(() => safeFetch("http://93.184.216.34/source"), /CAPTURE_URL_PRIVATE_IP_BLOCKED/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("readLimitedText enforces content type and byte limits", async () => {
  await assert.rejects(
    () => readLimitedText(new Response("{}", { headers: { "content-type": "application/json" } })),
    /CAPTURE_CONTENT_TYPE_BLOCKED/
  );

  process.env.CAPTURE_MAX_BYTES = "4";
  await assert.rejects(
    () => readLimitedText(new Response("hello", { headers: { "content-type": "text/plain" } })),
    /CAPTURE_RESPONSE_TOO_LARGE/
  );

  const text = await readLimitedText(new Response("ok", { headers: { "content-type": "text/html" } }));
  assert.equal(text, "ok");
});
