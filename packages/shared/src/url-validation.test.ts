import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { httpUrlSchema } from "./validation.js";

describe("httpUrlSchema", () => {
  it("accepts http and https URLs", () => {
    assert.equal(httpUrlSchema.safeParse("http://example.com").success, true);
    assert.equal(httpUrlSchema.safeParse("https://example.com").success, true);
    assert.equal(httpUrlSchema.safeParse("https://sub.example.com/path?query=1#hash").success, true);
  });

  it("rejects non-http schemes", () => {
    const javascriptResult = httpUrlSchema.safeParse("javascript:alert(1)");
    assert.equal(javascriptResult.success, false);
    if (!javascriptResult.success) {
      assert.equal(javascriptResult.error.issues[0]?.message, "URL must use http or https protocol");
    }

    assert.equal(httpUrlSchema.safeParse("data:text/plain;base64,SGVsbG8=").success, false);
    assert.equal(httpUrlSchema.safeParse("ftp://example.com").success, false);
    assert.equal(httpUrlSchema.safeParse("mailto:test@example.com").success, false);
  });

  it("rejects invalid URLs", () => {
    assert.equal(httpUrlSchema.safeParse("not-a-url").success, false);
    assert.equal(httpUrlSchema.safeParse("").success, false);
  });
});
