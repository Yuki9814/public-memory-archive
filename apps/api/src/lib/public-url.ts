export function getPublicSiteUrl(): string {
  const configured = process.env.PUBLIC_SITE_URL?.trim();
  const production = process.env.NODE_ENV === "production";
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") {
        if (production && url.protocol !== "https:") {
          throw new Error("PUBLIC_SITE_URL must use https in production");
        }
        return configured.replace(/\/+$/, "");
      }
    } catch {
      if (production) {
        throw new Error("PUBLIC_SITE_URL must be a valid http(s) URL in production");
      }
      return "http://localhost:5173";
    }
  }
  if (production) {
    throw new Error("PUBLIC_SITE_URL is required in production");
  }
  return "http://localhost:5173";
}

export function getPublicSiteOrigin(): string {
  return new URL(getPublicSiteUrl()).origin;
}
