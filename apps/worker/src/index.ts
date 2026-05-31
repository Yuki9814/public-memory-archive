import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { captureQueueName } from "./queue.js";
import { captureSource } from "./capture.js";
import { getCaptureConcurrency } from "./concurrency.js";
import { getWorkerRedisUrl } from "./redis-config.js";

const redisUrl = getWorkerRedisUrl();
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null
});

const worker = new Worker(
  captureQueueName,
  async (job) => {
    if (job.name !== "capture-source") return;
    await captureSource(job.data.taskId, job.data.sourceId);
  },
  {
    connection,
    concurrency: getCaptureConcurrency()
  }
);

worker.on("completed", (job) => {
  console.log(`capture job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`capture job failed: ${job?.id}`, error);
});

process.on("SIGINT", async () => {
  await worker.close();
  await connection.quit();
  process.exit(0);
});

console.log(`Worker listening on queue ${captureQueueName}`);
