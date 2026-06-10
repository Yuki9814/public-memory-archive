export type RevisionDiffField = {
  path: string;
  before: unknown;
  after: unknown;
};

const MAX_DIFFS = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function summarize(value: unknown): unknown {
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (!isRecord(value)) return value;
  if ("id" in value && typeof value.id === "string") {
    const label = typeof value.neutralTitle === "string"
      ? value.neutralTitle
      : typeof value.title === "string"
        ? value.title
        : typeof value.changeSummary === "string"
          ? value.changeSummary
          : value.id;
    return { id: value.id, label };
  }
  return `{${Object.keys(value).length} fields}`;
}

export function buildRevisionDiff(before: unknown, after: unknown, basePath = ""): RevisionDiffField[] {
  if (stableJson(before) === stableJson(after)) return [];
  if (Array.isArray(before) || Array.isArray(after)) {
    return [{ path: basePath || "$", before: summarize(before), after: summarize(after) }];
  }
  if (!isRecord(before) || !isRecord(after)) {
    return [{ path: basePath || "$", before: summarize(before), after: summarize(after) }];
  }

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes: RevisionDiffField[] = [];
  for (const key of keys) {
    const path = basePath ? `${basePath}.${key}` : key;
    changes.push(...buildRevisionDiff(before[key], after[key], path));
    if (changes.length >= MAX_DIFFS) break;
  }
  return changes.slice(0, MAX_DIFFS);
}
