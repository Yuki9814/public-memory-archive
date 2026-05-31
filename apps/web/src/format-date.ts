export function formatDate(value?: string | null): string {
  if (!value) return "未标注";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "未标注";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function getTimeSafe(value?: string | null): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
