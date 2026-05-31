import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("manual Zod validation errors return HTTP 400", async () => {
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/events?page=invalid"
    });
    const body = response.json();

    assert.equal(response.statusCode, 400);
    assert.equal(body.error, "VALIDATION_ERROR");
    assert.equal(body.message, "Request validation failed");
    assert.ok(Array.isArray(body.details));
  } finally {
    await app.close();
  }
});

test("generic thrown errors return stable HTTP 500 without leaking internals", async () => {
  const app = await buildApp();
  app.get("/__test-error-leak", async () => {
    throw new Error("internal secret xyz123");
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/__test-error-leak"
    });
    const body = response.json();
    const bodyText = JSON.stringify(body);

    assert.equal(response.statusCode, 500);
    assert.deepEqual(body, {
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    });
    assert.equal(bodyText.includes("internal secret"), false);
    assert.equal(bodyText.includes("xyz123"), false);
  } finally {
    await app.close();
  }
});
