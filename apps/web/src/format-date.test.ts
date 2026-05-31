import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDate, getTimeSafe } from "./format-date.js";

describe("formatDate", () => {
  it("returns fallback for missing, blank, and whitespace-only values", () => {
    for (const value of [undefined, null, "", "   ", "\t\n  ", "\r\n\t  "] as Array<string | null | undefined>) {
      assert.equal(formatDate(value), "未标注", `value=${JSON.stringify(value)}`);
    }
  });

  it("returns fallback for invalid date strings without throwing", () => {
    for (const value of ["not-a-valid-date", "2026-99-99T00:00:00Z", "invalid", "NaN", "2026/13/01"]) {
      assert.equal(formatDate(value), "未标注", `value=${JSON.stringify(value)}`);
    }
  });

  it("formats valid ISO date strings", () => {
    const result = formatDate("2026-05-25T10:00:00.000Z");

    assert.notEqual(result, "未标注");
    assert.match(result, /\d{4}[/年]\d{2}/);
  });

  it("keeps leap-day and future dates valid", () => {
    assert.notEqual(formatDate("2024-02-29T12:00:00Z"), "未标注");
    assert.notEqual(formatDate("2030-01-01T00:00:00Z"), "未标注");
  });
});

describe("getTimeSafe", () => {
  it("returns 0 for missing, blank, and invalid date values", () => {
    for (const value of [undefined, null, "", "   ", "not-a-date", "2026-99-99", "bad"] as Array<string | null | undefined>) {
      const timestamp = getTimeSafe(value);

      assert.equal(timestamp, 0, `value=${JSON.stringify(value)}`);
      assert.equal(Number.isFinite(timestamp), true);
    }
  });

  it("returns exact milliseconds for valid ISO strings", () => {
    const value = "2026-05-25T12:34:00.000Z";
    const timestamp = getTimeSafe(value);

    assert.equal(timestamp, new Date(value).getTime());
    assert.equal(Number.isFinite(timestamp), true);
  });
});
