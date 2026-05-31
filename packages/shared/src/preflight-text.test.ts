import assert from "node:assert/strict";
import test from "node:test";
import {
  containsSensitivePersonalInfo,
  describeSensitiveHits,
  findIncitingTerms
} from "./preflight-text.js";
import {
  getEventProcessStatusLabel,
  getReliabilityLabel,
  reportTypes,
  sourceTypes,
  evidenceKinds
} from "./enums.js";
import { reportSchema, createSourceSchema, createEvidenceSchema } from "./validation.js";

test("detects inciting terms in titles", () => {
  assert.deepEqual(findIncitingTerms("某平台婚恋纠纷引发网络争议"), []);
  assert.ok(findIncitingTerms("去冲某某").includes("去冲"));
});

test("detects common sensitive personal information", () => {
  assert.equal(containsSensitivePersonalInfo("联系电话 13812345678"), true);
  assert.ok(describeSensitiveHits("证件 110101199901011234").includes("ID_CARD"));
});

// --- Tests for centralized labels (consistency refactor) ---
test("getEventProcessStatusLabel returns canonical neutral labels", () => {
  assert.equal(getEventProcessStatusLabel("UNVERIFIED"), "材料收集中");
  assert.equal(getEventProcessStatusLabel("CONCLUDED"), "阶段性收束");
  assert.equal(getEventProcessStatusLabel("UNKNOWN_FOO"), "UNKNOWN_FOO");
});

test("getReliabilityLabel returns canonical labels and falls back safely", () => {
  assert.equal(getReliabilityLabel("A_STRONG"), "A 强证据");
  assert.equal(getReliabilityLabel("D_WEAK"), "D 弱线索");
  assert.equal(getReliabilityLabel(null), "未定级");
  assert.equal(getReliabilityLabel("FOO"), "FOO");
});

// --- Tests for stricter validation schemas (validation refactor) ---
test("validation schemas now enforce enums for sourceType, evidenceKind, reportType", () => {
  // valid
  const src = createSourceSchema.parse({ title: "t", summary: "s", reliabilityLevel: "B_DIRECT", sourceType: "ORIGINAL_POST" });
  assert.equal(src.sourceType, "ORIGINAL_POST");

  const ev = createEvidenceSchema.parse({ title: "e", description: "d", reliabilityLevel: "C_INDIRECT", evidenceKind: "SCREENSHOT" });
  assert.equal(ev.evidenceKind, "SCREENSHOT");

  const rep = reportSchema.parse({ title: "r", body: "b", reportType: "PRIVACY_LEAK" });
  assert.equal(rep.reportType, "PRIVACY_LEAK");
});

test("validation rejects invalid enum values for tightened fields", () => {
  assert.throws(() => createSourceSchema.parse({ title: "t", summary: "s", reliabilityLevel: "B_DIRECT", sourceType: "INVALID" }));
  assert.throws(() => reportSchema.parse({ title: "r", body: "b", reportType: "NOT_A_TYPE" }));
});
