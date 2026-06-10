import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { correctionResolveSchema, eventListQuerySchema, submissionResolveSchema } from "./validation.js";

describe("eventListQuerySchema date ranges", () => {
  it("accepts valid ordered and equal date ranges", () => {
    assert.equal(eventListQuerySchema.safeParse({ dateFrom: "2025-01-01", dateTo: "2025-02-01" }).success, true);
    assert.equal(eventListQuerySchema.safeParse({ dateFrom: "2025-01-01", dateTo: "2025-01-01" }).success, true);
  });

  it("accepts open-ended date ranges", () => {
    assert.equal(eventListQuerySchema.safeParse({ dateFrom: "2025-01-01" }).success, true);
    assert.equal(eventListQuerySchema.safeParse({ dateTo: "2025-01-01" }).success, true);
    assert.equal(eventListQuerySchema.safeParse({}).success, true);
  });

  it("rejects reversed date ranges", () => {
    const result = eventListQuerySchema.safeParse({ dateFrom: "2025-02-01", dateTo: "2025-01-01" });

    assert.equal(result.success, false);
    if (!result.success) {
      const issue = result.error.issues.find((item) => item.path.includes("dateFrom"));
      assert.equal(issue?.message, "dateFrom must be less than or equal to dateTo");
    }
  });
});

describe("eventListQuerySchema sort", () => {
  it("accepts sourceCount and other known sort values", () => {
    assert.equal(eventListQuerySchema.safeParse({ sort: "sourceCount" }).success, true);
    assert.equal(eventListQuerySchema.safeParse({ sort: "newest" }).success, true);
    assert.equal(eventListQuerySchema.safeParse({ sort: "oldest" }).success, true);
    assert.equal(eventListQuerySchema.safeParse({ sort: "updated" }).success, true);
  });
});

describe("feedback resolve schemas", () => {
  it("accepts submission resolution metadata with linked entity pairs", () => {
    assert.equal(submissionResolveSchema.safeParse({
      status: "ACCEPTED",
      resolutionNotes: "材料已转为来源。",
      resolutionAction: "converted_to_source",
      linkedEntityType: "Source",
      linkedEntityId: "src_1"
    }).success, true);
  });

  it("rejects half-linked submission metadata", () => {
    assert.equal(submissionResolveSchema.safeParse({
      status: "ACCEPTED",
      linkedEntityType: "Source"
    }).success, false);
  });

  it("requires notes, action, and linked entity for accepted corrections", () => {
    assert.equal(correctionResolveSchema.safeParse({
      status: "ACCEPTED"
    }).success, false);
    assert.equal(correctionResolveSchema.safeParse({
      status: "ACCEPTED",
      resolutionNotes: "已修正来源摘要。",
      resolutionAction: "linked_entity_updated",
      linkedEntityType: "Source",
      linkedEntityId: "src_1"
    }).success, true);
  });

  it("allows rejected corrections without linked entity metadata", () => {
    assert.equal(correctionResolveSchema.safeParse({
      status: "REJECTED",
      resolutionNotes: "材料不足。"
    }).success, true);
  });
});
