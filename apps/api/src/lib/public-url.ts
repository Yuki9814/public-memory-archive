export function getPublicSiteUrl(): string {
  const configured = process.env.PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return configured.replace(/\/+$/, "");
      }
    } catch {
      return "http://localhost:5173";
    }
  }
  return "http://localhost:5173";
}

export function getPublicSiteOrigin(): string {
  try {
    return new URL(getPublicSiteUrl()).origin;
  } catch {
    return "http://localhost:5173";
  }
}
