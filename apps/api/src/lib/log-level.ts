export function resolveLogLevel(raw: string | undefined): string {
  if (typeof raw !== "string") return "info";

  const trimmed = raw.trim();
  return trimmed || "info";
}
