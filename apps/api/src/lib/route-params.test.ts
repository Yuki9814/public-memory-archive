import { test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyRequest } from "fastify";
import { getIdParam, getSlugParam, getTaskIdParam } from "./route-params.js";

function makeRequest(params: unknown): FastifyRequest {
  return { params } as FastifyRequest;
}

test("getIdParam extracts string id from params", () => {
  const req = makeRequest({ id: "evt_abc123" });
  assert.equal(getIdParam(req), "evt_abc123");
});

test("getSlugParam extracts string slug from params", () => {
  const req = makeRequest({ slug: "test-event-slug" });
  assert.equal(getSlugParam(req), "test-event-slug");
});

test("getTaskIdParam extracts string taskId from params", () => {
  const req = makeRequest({ taskId: "task_987" });
  assert.equal(getTaskIdParam(req), "task_987");
});

test("helpers return the value as-is (including falsy cases for current behavior)", () => {
  // documents current cast behavior: missing key yields undefined (typed as string)
  const reqMissing = makeRequest({});
  assert.equal(getIdParam(reqMissing), undefined);
  assert.equal(getSlugParam(reqMissing), undefined);
  assert.equal(getTaskIdParam(reqMissing), undefined);

  const reqOther = makeRequest({ foo: "bar" });
  assert.equal(getSlugParam(reqOther), undefined);
});
