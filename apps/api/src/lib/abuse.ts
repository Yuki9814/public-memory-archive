import type { FastifyReply, FastifyRequest } from "fastify";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  retryAfterSeconds: number;
};

export function consumeBucket(key: string, max: number, windowMs: number, now = Date.now()): RateLimitResult {
  for (const [bucketKey, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  current.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return { ok: current.count <= max, retryAfterSeconds };
}

export function clientKey(request: FastifyRequest, scope: string) {
  return `${scope}:${request.ip ?? request.socket.remoteAddress ?? "unknown"}`;
}

export function rejectIfLimited(reply: FastifyReply, result: RateLimitResult) {
  if (result.ok) return false;
  reply.header("Retry-After", String(result.retryAfterSeconds));
  reply.code(429).send({ error: "RATE_LIMITED", message: "Too many requests. Please retry later." });
  return true;
}

export function hasFilledHoneypot(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return false;
  const value = (body as { website?: unknown }).website;
  return typeof value === "string" && value.trim().length > 0;
}
