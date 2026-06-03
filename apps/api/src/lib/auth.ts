import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export const ADMIN_SESSION_COOKIE = "pm_admin_session";

export type PublicSession =
  | { role: "GUEST" }
  | { role: "ADMIN"; displayName: string; userId?: string; csrfToken: string };

type AdminSessionPayload = {
  role: "ADMIN";
  displayName: string;
  userId?: string;
  jti: string;
  iat: number;
  exp: number;
};

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const SESSION_IDLE_SECONDS = 60 * 60 * 2;

const activeSessions = new Map<string, { exp: number; lastSeen: number; revoked: boolean }>();

function normalizeAdminEnv(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.trim() ? raw : undefined;
}

function sessionSecret() {
  return normalizeAdminEnv(process.env.ADMIN_SESSION_SECRET);
}

export function adminDisplayName() {
  return normalizeAdminEnv(process.env.ADMIN_DISPLAY_NAME) ?? "馆长";
}

export function adminUserId(): string | undefined {
  return normalizeAdminEnv(process.env.ADMIN_USER_ID);
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signPayload(payload: string) {
  const secret = sessionSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookies(cookieHeader: string | undefined) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies.set(key, safeDecode(value));
  }
  return cookies;
}

function parseSessionToken(token: string) {
  const segments = token.split(".");
  if (segments.length !== 2) return null;
  const [encodedPayload, signature] = segments;
  if (!encodedPayload || !signature) return null;
  return { encodedPayload, signature };
}

function isAdminSessionPayload(payload: unknown): payload is AdminSessionPayload {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return false;
  const value = payload as Partial<AdminSessionPayload>;
  return (
    value.role === "ADMIN" &&
    typeof value.displayName === "string" &&
    typeof value.jti === "string" &&
    value.jti.length > 0 &&
    typeof value.iat === "number" &&
    Number.isFinite(value.iat) &&
    typeof value.exp === "number" &&
    Number.isFinite(value.exp) &&
    (value.userId === undefined || typeof value.userId === "string")
  );
}

function cleanupSessions(now: number) {
  for (const [jti, session] of activeSessions) {
    if (session.revoked || session.exp < now || session.lastSeen + SESSION_IDLE_SECONDS < now) {
      activeSessions.delete(jti);
    }
  }
}

function csrfTokenForJti(jti: string) {
  const signature = signPayload(`csrf:${jti}`);
  if (!signature) return null;
  return signature;
}

export function createAdminSession(userId?: string) {
  const now = Math.floor(Date.now() / 1000);
  cleanupSessions(now);
  const payload: AdminSessionPayload = {
    role: "ADMIN",
    displayName: adminDisplayName(),
    userId: normalizeAdminEnv(userId),
    jti: randomUUID(),
    iat: now,
    exp: now + SESSION_TTL_SECONDS
  };
  const encodedPayload = base64UrlJson(payload);
  const signature = signPayload(encodedPayload);
  if (!signature) throw new Error("ADMIN_SESSION_SECRET is required to create admin sessions");
  activeSessions.set(payload.jti, { exp: payload.exp, lastSeen: now, revoked: false });
  return `${encodedPayload}.${signature}`;
}

export function csrfTokenFromSessionToken(token: string) {
  const parsedToken = parseSessionToken(token);
  if (!parsedToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(parsedToken.encodedPayload, "base64url").toString("utf8")) as unknown;
    if (!isAdminSessionPayload(payload)) return null;
    return csrfTokenForJti(payload.jti);
  } catch {
    return null;
  }
}

export function getAdminSession(request: FastifyRequest): PublicSession | null {
  const token = parseCookies(request.headers.cookie).get(ADMIN_SESSION_COOKIE);
  if (!token) return null;
  const parsedToken = parseSessionToken(token);
  if (!parsedToken) return null;
  const { encodedPayload, signature } = parsedToken;
  const expectedSignature = signPayload(encodedPayload);
  if (!expectedSignature || !safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
    if (!isAdminSessionPayload(payload)) return null;
    const now = Math.floor(Date.now() / 1000);
    cleanupSessions(now);
    const active = activeSessions.get(payload.jti);
    if (!active || active.revoked || payload.role !== "ADMIN" || payload.exp < now || active.exp < now) return null;
    if (active.lastSeen + SESSION_IDLE_SECONDS < now) {
      activeSessions.delete(payload.jti);
      return null;
    }
    active.lastSeen = now;
    const csrfToken = csrfTokenForJti(payload.jti);
    if (!csrfToken) return null;
    return { role: "ADMIN", displayName: payload.displayName, userId: payload.userId, csrfToken };
  } catch {
    return null;
  }
}

export function serializeAdminSessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function serializeClearAdminSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const session = getAdminSession(request);
  if (!session) {
    return reply.code(401).send({ error: "ADMIN_SESSION_REQUIRED" });
  }
  if (session.role !== "ADMIN") {
    return reply.code(403).send({ error: "ADMIN_FORBIDDEN" });
  }
}

export function revokeAdminSession(request: FastifyRequest) {
  const token = parseCookies(request.headers.cookie).get(ADMIN_SESSION_COOKIE);
  const parsedToken = token ? parseSessionToken(token) : null;
  if (!parsedToken) return;
  try {
    const payload = JSON.parse(Buffer.from(parsedToken.encodedPayload, "base64url").toString("utf8")) as unknown;
    if (isAdminSessionPayload(payload)) {
      const active = activeSessions.get(payload.jti);
      if (active) active.revoked = true;
      activeSessions.delete(payload.jti);
    }
  } catch {
    // Invalid tokens are already treated as logged out.
  }
}

export function validateAdminCsrf(request: FastifyRequest) {
  const session = getAdminSession(request);
  if (!session || session.role !== "ADMIN") return false;
  const token = request.headers["x-csrf-token"];
  if (typeof token !== "string" || token.length === 0) return false;
  return safeEqual(token, session.csrfToken);
}

export function validateAdminPasscode(passcode: string) {
  const expected = normalizeAdminEnv(process.env.ADMIN_PASSCODE);
  if (!expected || !sessionSecret()) return { ok: false, reason: "not_configured" as const };
  return { ok: safeEqual(passcode, expected), reason: "checked" as const };
}
