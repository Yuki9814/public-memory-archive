import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const captureQueueName = "archive-capture";

let connection: Redis | undefined;
let queue: Queue | undefined;

export function configuredRedisUrl(): string | undefined {
  const url = process.env.REDIS_URL?.trim();
  return url && url.length > 0 ? url : undefined;
}

function getConnection() {
  const url = configuredRedisUrl();
  if (!url) return undefined;
  connection ??= new Redis(url, {
    maxRetriesPerRequest: null
  });
  return connection;
}

export function getCaptureQueue() {
  const redis = getConnection();
  if (!redis) return undefined;
  queue ??= new Queue(captureQueueName, { connection: redis });
  return queue;
}

export async function enqueueCaptureTask(taskId: string, sourceId: string) {
  try {
    const captureQueue = getCaptureQueue();
    if (!captureQueue) return false;
    await captureQueue.add(
      "capture-source",
      { taskId, sourceId },
      {
        jobId: taskId,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );
    return true;
  } catch {
    return false;
  }
}
