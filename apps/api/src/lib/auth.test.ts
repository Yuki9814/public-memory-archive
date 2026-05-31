import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { buildApp } from "../app.js";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSession,
  serializeAdminSessionCookie,
  serializeClearAdminSessionCookie,
  validateAdminPasscode
} from "./auth.js";

function signTestPayload(payload: string, secret = "test-session-secret") {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

type AdminEnvKey = "ADMIN_PASSCODE" | "ADMIN_SESSION_SECRET" | "ADMIN_DISPLAY_NAME" | "ADMIN_USER_ID";

function saveAdminEnv(): Record<AdminEnvKey, string | undefined> {
  return {
    ADMIN_PASSCODE: process.env.ADMIN_PASSCODE,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    ADMIN_DISPLAY_NAME: process.env.ADMIN_DISPLAY_NAME,
    ADMIN_USER_ID: process.env.ADMIN_USER_ID
  };
}

function restoreAdminEnv(saved: Record<AdminEnvKey, string | undefined>) {
  for (const key of Object.keys(saved) as AdminEnvKey[]) {
    restoreEnv(key, saved[key]);
  }
}

function decodeAdminPayload(token: string) {
  const [encodedPayload] = token.split(".");
  return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as { displayName: string };
}

test("session defaults to guest and blocks admin routes", async () => {
  process.env.ADMIN_PASSCODE = "test-passcode";
  process.env.ADMIN_SESSION_SECRET = "test-session-secret";
  process.env.ADMIN_DISPLAY_NAME = "馆长";
  delete process.env.ADMIN_USER_ID;

  const app = await buildApp();
  const session = await app.inject({ method: "GET", url: "/api/session" });
  assert.equal(session.statusCode, 200);
  assert.deepEqual(session.json(), { role: "GUEST" });

  const admin = await app.inject({ method: "GET", url: "/admin/review-tasks" });
  assert.equal(admin.statusCode, 401);
  assert.equal(admin.json().error, "ADMIN_SESSION_REQUIRED");
  await app.close();
});

test("admin passcode creates a signed session cookie", async () => {
  process.env.ADMIN_PASSCODE = "test-passcode";
  process.env.ADMIN_SESSION_SECRET = "test-session-secret";
  process.env.ADMIN_DISPLAY_NAME = "馆长";
  delete process.env.ADMIN_USER_ID;

  const app = await buildApp();
  const failed = await app.inject({
    method: "POST",
    url: "/api/auth/admin-login",
    headers: { "content-type": "application/json" },
    payload: { passcode: "wrong" }
  });
  assert.equal(failed.statusCode, 401);

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/admin-login",
    headers: { "content-type": "application/json" },
    payload: { passcode: "test-passcode" }
  });
  assert.equal(login.statusCode, 200);
  assert.deepEqual(login.json(), { role: "ADMIN", displayName: "馆长" });

  const setCookie = login.headers["set-cookie"];
  assert.equal(typeof setCookie, "string");
  assert.match(setCookie as string, /pm_admin_session=/);

  const session = await app.inject({
    method: "GET",
    url: "/api/session",
    headers: { cookie: (setCookie as string).split(";")[0] }
  });
  assert.equal(session.statusCode, 200);
  assert.deepEqual(session.json(), { role: "ADMIN", displayName: "馆长" });
  await app.close();
});

test("admin session cookie attributes are stable", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "test";
    const devCookie = serializeAdminSessionCookie("token");
    assert.match(devCookie, new RegExp(`^${ADMIN_SESSION_COOKIE}=token;`));
    assert.match(devCookie, /HttpOnly/);
    assert.match(devCookie, /SameSite=Lax/);
    assert.match(devCookie, /Path=\//);
    assert.doesNotMatch(devCookie, /Secure/);

    process.env.NODE_ENV = "production";
    const productionCookie = serializeAdminSessionCookie("token");
    const clearCookie = serializeClearAdminSessionCookie();
    assert.match(productionCookie, /Secure/);
    assert.match(clearCookie, /Max-Age=0/);
    assert.match(clearCookie, /Secure/);
  } finally {
    restoreEnv("NODE_ENV", originalNodeEnv);
  }
});

test("session token parser rejects malformed or ambiguous tokens", async () => {
  process.env.ADMIN_SESSION_SECRET = "test-session-secret";
  process.env.ADMIN_DISPLAY_NAME = "馆长";

  const validToken = createAdminSession();
  const invalidJsonPayload = Buffer.from("not-json", "utf8").toString("base64url");
  const missingFieldsPayload = Buffer.from(JSON.stringify({}), "utf8").toString("base64url");
  const badTokens = [
    "nosignature",
    ".signature",
    "payload.",
    `${validToken}.extra`,
    `${invalidJsonPayload}.${signTestPayload(invalidJsonPayload)}`,
    `${missingFieldsPayload}.${signTestPayload(missingFieldsPayload)}`,
    validToken.replace(/\.[^.]+$/, ".bad-signature")
  ];

  const app = await buildApp();
  try {
    for (const token of badTokens) {
      const response = await app.inject({
        method: "GET",
        url: "/api/session",
        headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` }
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { role: "GUEST" }, `token should be rejected: ${token}`);
    }
  } finally {
    await app.close();
  }
});

test("malformed cookie percent-encoding yields guest session instead of 500", async () => {
  process.env.ADMIN_PASSCODE = "test-passcode";
  process.env.ADMIN_SESSION_SECRET = "test-session-secret";
  process.env.ADMIN_DISPLAY_NAME = "馆长";
  delete process.env.ADMIN_USER_ID;

  const app = await buildApp();
  const badCases = [
    "pm_admin_session=abc%def",
    "pm_admin_session=foo%bar%baz",
    "pm_admin_session=%E0%A4%A",
    "other=bad%; pm_admin_session=goodvalue",
    "pm_admin_session=abc%def; other=xyz%00"
  ];

  for (const cookie of badCases) {
    const response = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: { cookie }
    });

    assert.equal(response.statusCode, 200, `malformed cookie should not 500: ${cookie}`);
    assert.deepEqual(response.json(), { role: "GUEST" });
  }

  await app.close();
});

test("malformed cookie percent-encoding blocks admin with 401 instead of 500", async () => {
  process.env.ADMIN_PASSCODE = "test-passcode";
  process.env.ADMIN_SESSION_SECRET = "test-session-secret";
  process.env.ADMIN_DISPLAY_NAME = "馆长";
  delete process.env.ADMIN_USER_ID;

  const app = await buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/admin/review-tasks",
    headers: { cookie: "pm_admin_session=bad%percent" }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, "ADMIN_SESSION_REQUIRED");
  await app.close();
});

test("blank admin secret and passcode env values are treated as not configured", () => {
  const saved = saveAdminEnv();

  try {
    for (const value of ["", "   ", "\t\n  "]) {
      process.env.ADMIN_SESSION_SECRET = value;
      process.env.ADMIN_PASSCODE = "real-passcode";

      assert.throws(() => createAdminSession(), /ADMIN_SESSION_SECRET is required/);
      assert.deepEqual(validateAdminPasscode("real-passcode"), { ok: false, reason: "not_configured" });

      process.env.ADMIN_SESSION_SECRET = "real-secret";
      process.env.ADMIN_PASSCODE = value;

      assert.deepEqual(validateAdminPasscode("real-passcode"), { ok: false, reason: "not_configured" });
    }
  } finally {
    restoreAdminEnv(saved);
  }
});

test("blank admin display name falls back to default display name", () => {
  const saved = saveAdminEnv();

  try {
    process.env.ADMIN_SESSION_SECRET = "real-secret";
    process.env.ADMIN_PASSCODE = "real-passcode";
    delete process.env.ADMIN_USER_ID;

    for (const value of ["", "   ", "\t\n  "]) {
      process.env.ADMIN_DISPLAY_NAME = value;

      assert.equal(decodeAdminPayload(createAdminSession()).displayName, "馆长");
    }
  } finally {
    restoreAdminEnv(saved);
  }
});

test("non-blank admin env values remain verbatim", () => {
  const saved = saveAdminEnv();

  try {
    process.env.ADMIN_SESSION_SECRET = "  s e c r e t  ";
    process.env.ADMIN_PASSCODE = "  p a s s  ";
    process.env.ADMIN_DISPLAY_NAME = "  Name  ";
    delete process.env.ADMIN_USER_ID;

    const token = createAdminSession();
    assert.ok(token.includes("."));
    assert.deepEqual(validateAdminPasscode("  p a s s  "), { ok: true, reason: "checked" });
    assert.deepEqual(validateAdminPasscode("p a s s"), { ok: false, reason: "checked" });
    assert.equal(decodeAdminPayload(token).displayName, "  Name  ");
  } finally {
    restoreAdminEnv(saved);
  }
});

test("admin login response and session use normalized display name and user id", async () => {
  const saved = saveAdminEnv();

  try {
    process.env.ADMIN_PASSCODE = "test-passcode";
    process.env.ADMIN_SESSION_SECRET = "test-session-secret";

    for (const value of ["", "   ", "\t\n  "]) {
      process.env.ADMIN_DISPLAY_NAME = value;
      process.env.ADMIN_USER_ID = value;

      const app = await buildApp();
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/admin-login",
        headers: { "content-type": "application/json" },
        payload: { passcode: "test-passcode" }
      });

      assert.equal(login.statusCode, 200);
      assert.deepEqual(login.json(), { role: "ADMIN", displayName: "馆长" });

      const setCookie = login.headers["set-cookie"] as string;
      const session = await app.inject({
        method: "GET",
        url: "/api/session",
        headers: { cookie: setCookie.split(";")[0] }
      });

      assert.equal(session.statusCode, 200);
      assert.deepEqual(session.json(), { role: "ADMIN", displayName: "馆长" });
      await app.close();
    }

    process.env.ADMIN_DISPLAY_NAME = "";
    process.env.ADMIN_USER_ID = "  curator-42  ";
    const app = await buildApp();
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/admin-login",
      headers: { "content-type": "application/json" },
      payload: { passcode: "test-passcode" }
    });

    assert.equal(login.statusCode, 200);
    assert.deepEqual(login.json(), { role: "ADMIN", displayName: "馆长", userId: "  curator-42  " });

    const setCookie = login.headers["set-cookie"] as string;
    const session = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: { cookie: setCookie.split(";")[0] }
    });

    assert.equal(session.statusCode, 200);
    assert.deepEqual(session.json(), { role: "ADMIN", displayName: "馆长", userId: "  curator-42  " });
    await app.close();
  } finally {
    restoreAdminEnv(saved);
  }
});
