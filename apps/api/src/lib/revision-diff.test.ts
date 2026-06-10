import assert from "node:assert/strict";
import test from "node:test";
import { buildRevisionDiff } from "./revision-diff.js";

test("buildRevisionDiff reports scalar field changes", () => {
  const diff = buildRevisionDiff({ title: "old", summary: "same" }, { title: "new", summary: "same" });
  assert.deepEqual(diff, [{ path: "title", before: "old", after: "new" }]);
});

test("buildRevisionDiff summarizes arrays instead of noisy item diffs", () => {
  const diff = buildRevisionDiff({ sources: [{ id: "s1" }] }, { sources: [{ id: "s1" }, { id: "s2" }] });
  assert.deepEqual(diff, [{ path: "sources", before: "[1 items]", after: "[2 items]" }]);
});

test("buildRevisionDiff returns empty list when snapshots match", () => {
  assert.deepEqual(buildRevisionDiff({ nested: { value: 1 } }, { nested: { value: 1 } }), []);
});
