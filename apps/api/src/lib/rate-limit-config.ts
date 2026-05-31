export type RateLimitConfig = {
  max: number;
  timeWindow: string;
};

export function getRateLimitConfig(): RateLimitConfig {
  return {
    max: parsePositiveInteger(process.env.RATE_LIMIT_MAX, 120),
    timeWindow: parseTimeWindow(process.env.RATE_LIMIT_WINDOW, "1 minute")
  };
}

function parsePositiveInteger(raw: string | undefined, fallback: number): number {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

function parseTimeWindow(raw: string | undefined, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  return trimmed || fallback;
}
