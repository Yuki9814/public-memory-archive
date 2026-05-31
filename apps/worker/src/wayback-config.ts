export function isWaybackEnabled(raw: string | undefined): boolean {
  return raw?.trim() === "true";
}

export function isConfiguredWaybackEnabled(): boolean {
  return isWaybackEnabled(process.env.ENABLE_WAYBACK);
}
