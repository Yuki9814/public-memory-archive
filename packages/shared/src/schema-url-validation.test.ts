import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPlatformLinkSchema, createSourceSchema, submissionSchema } from "./validation.js";

describe("schema URL validation", () => {
  describe("submissionSchema.sourceUrl", () => {
    it("accepts http and https URLs", () => {
      assert.equal(submissionSchema.safeParse({
        title: "Test Submission",
        body: "Test Body",
        sourceUrl: "https://example.com"
      }).success, true);
    });

    it("rejects non-http URLs", () => {
      const result = submissionSchema.safeParse({
        title: "Test Submission",
        body: "Test Body",
        sourceUrl: "javascript:alert(1)"
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error.issues.find((issue) => issue.path.includes("sourceUrl"))?.message, "URL must use http or https protocol");
      }
    });

    it("allows missing optional sourceUrl", () => {
      assert.equal(submissionSchema.safeParse({
        title: "Test Submission",
        body: "Test Body"
      }).success, true);
    });
  });

  describe("createPlatformLinkSchema.originalUrl", () => {
    const baseData = {
      platform: "WEIBO",
      contentKind: "POST",
      title: "Test Title",
      description: "This is a long enough description for the schema requirements."
    };

    it("accepts http and https URLs", () => {
      assert.equal(createPlatformLinkSchema.safeParse({
        ...baseData,
        originalUrl: "https://weibo.com/user/status/123"
      }).success, true);
    });

    it("rejects non-http URLs", () => {
      const result = createPlatformLinkSchema.safeParse({
        ...baseData,
        originalUrl: "ftp://example.com/file"
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error.issues.find((issue) => issue.path.includes("originalUrl"))?.message, "URL must use http or https protocol");
      }
    });
  });

  describe("createSourceSchema.url", () => {
    const baseData = {
      title: "Test Source",
      reliabilityLevel: "B_DIRECT",
      summary: "Test Summary"
    };

    it("accepts http and https URLs", () => {
      assert.equal(createSourceSchema.safeParse({
        ...baseData,
        url: "https://example.com/source"
      }).success, true);
    });

    it("rejects non-http URLs", () => {
      const result = createSourceSchema.safeParse({
        ...baseData,
        url: "data:text/plain;base64,SGVsbG8="
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error.issues.find((issue) => issue.path.includes("url"))?.message, "URL must use http or https protocol");
      }
    });

    it("allows missing optional url", () => {
      assert.equal(createSourceSchema.safeParse(baseData).success, true);
    });
  });
});
