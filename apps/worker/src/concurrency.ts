const DEFAULT_CAPTURE_CONCURRENCY = 2;

export function getCaptureConcurrency(): number {
  const trimmed = process.env.CAPTURE_CONCURRENCY?.trim();
  if (!trimmed) return DEFAULT_CAPTURE_CONCURRENCY;

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 1) return DEFAULT_CAPTURE_CONCURRENCY;
  return Math.floor(value);
}
