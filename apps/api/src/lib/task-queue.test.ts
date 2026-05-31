import assert from "node:assert/strict";
import test from "node:test";
import { configuredRedisUrl, enqueueCaptureTask } from "./task-queue.js";

function withRedisUrl(value: string | undefined, run: () => void) {
  const original = process.env.REDIS_URL;
  if (value === undefined) {
    delete process.env.REDIS_URL;
  } else {
    process.env.REDIS_URL = value;
  }
  try {
    run();
  } finally {
    process.env.REDIS_URL = original;
  }
}

async function withRedisUrlAsync(value: string | undefined, run: () => Promise<void>) {
  const original = process.env.REDIS_URL;
  if (value === undefined) {
    delete process.env.REDIS_URL;
  } else {
    process.env.REDIS_URL = value;
  }
  try {
    await run();
  } finally {
    if (original === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = original;
    }
  }
}

test("configuredRedisUrl returns undefined when REDIS_URL is missing", () => {
  withRedisUrl(undefined, () => {
    assert.equal(configuredRedisUrl(), undefined);
  });
});

test("configuredRedisUrl returns undefined when REDIS_URL is empty", () => {
  withRedisUrl("", () => {
    assert.equal(configuredRedisUrl(), undefined);
  });
});

test("configuredRedisUrl returns undefined when REDIS_URL is whitespace only", () => {
  withRedisUrl("   ", () => {
    assert.equal(configuredRedisUrl(), undefined);
  });
});

test("configuredRedisUrl returns trimmed URL when REDIS_URL is valid", () => {
  withRedisUrl("  redis://localhost:6379  ", () => {
    assert.equal(configuredRedisUrl(), "redis://localhost:6379");
  });
});

test("enqueueCaptureTask returns false when REDIS_URL is missing or blank", async () => {
  for (const value of [undefined, "", "   "]) {
    await withRedisUrlAsync(value, async () => {
      assert.equal(await enqueueCaptureTask("task_test", "source_test"), false);
    });
  }
});

test("enqueueCaptureTask returns false when configured Redis queue setup fails", async () => {
  await withRedisUrlAsync("http://[", async () => {
    assert.equal(await enqueueCaptureTask("task_test", "source_test"), false);
  });
});
