const DEFAULT_WORKER_REDIS_URL = "redis://localhost:6379";

export function getWorkerRedisUrl(): string {
  const url = process.env.REDIS_URL?.trim();
  return url && url.length > 0 ? url : DEFAULT_WORKER_REDIS_URL;
}
