import assert from "node:assert/strict";
import test from "node:test";
import { runPublishPreflight, type PreflightEvent } from "./preflight.js";

/**
 * Creates a mock PreflightEvent with defaults to simplify tests.
 * This centralizes the 'as unknown as PreflightEvent' cast and reduces boilerplate.
 */
function mockPreflightEvent(overrides: Record<string, unknown>): PreflightEvent {
  return {
    title: "Default Title",
    neutralTitle: "Default Neutral Title",
    summary: "Default Summary",
    correctionEnabled: true,
    reportEnabled: true,
    sources: [],
    timelineEntries: [],
    claims: [],
    eventActors: [],
    eventVersions: [],
    ...overrides
  } as unknown as PreflightEvent;
}

test("publish preflight accepts a minimally compliant event", () => {
  const failed = runPublishPreflight(
    mockPreflightEvent({
      title: "某事件公开资料档案",
      neutralTitle: "某事件公开资料档案",
      summary: "克制记录公开资料。",
      whatWeKnow: [],
      whatIsDisputed: [],
      whatNotToInfer: [],
      sources: [
        {
          id: "s1",
          title: "官方说明",
          reliabilityLevel: "A_STRONG",
          platformLinks: []
        }
      ],
      timelineEntries: [{ id: "t1", sourceId: "s1", title: "说明发布", body: "官方说明发布。" }],
      claims: [{ id: "c1", importance: "KEY", status: "SUPPORTED", evidenceLinks: [{ id: "l1" }] }],
      eventVersions: [{ id: "v1" }]
    })
  );
  assert.deepEqual(failed, []);
});

test("publish preflight blocks mobilizing language and missing version", () => {
  const failed = runPublishPreflight(
    mockPreflightEvent({
      title: "去冲某账号",
      neutralTitle: "去冲某账号",
      summary: "x"
    })
  );
  const codes = failed.map((item) => item.code);
  assert.ok(codes.includes("INCITING_TITLE"));
  assert.ok(codes.includes("VERSION_SNAPSHOT_REQUIRED"));
});

test("publish preflight enforces minor privacy level and high-privacy notes, plus sensitive info", () => {
  const failed = runPublishPreflight(
    mockPreflightEvent({
      title: "事件",
      neutralTitle: "事件",
      summary: "摘要",
      sources: [{ id: "s1", title: "源", reliabilityLevel: "A_STRONG", platformLinks: [] }],
      timelineEntries: [{ id: "t1", sourceId: "s1", title: "t", body: "身份证 110101199001011234 住址测试" }],
      eventActors: [
        { actor: { id: "a1", displayName: "未成年", isMinor: true, privacyLevel: "PUBLIC", privacyNote: "" } },
        { actor: { id: "a2", displayName: "高隐私", privacyLevel: "HIGH", privacyNote: "" } }
      ],
      eventVersions: [{ id: "v1" }]
    })
  );
  const codes = failed.map((item) => item.code);
  assert.ok(codes.includes("MINOR_HIGH_PRIVACY_REQUIRED"));
  assert.ok(codes.includes("HIGH_PRIVACY_NOTE_REQUIRED"));
  assert.ok(codes.includes("SENSITIVE_PERSONAL_INFO"));
});
