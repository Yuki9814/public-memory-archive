import { getPublicSiteOrigin } from "./public-url.js";

const LOCALHOST_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function getConfiguredCorsOrigin(): string {
  return getPublicSiteOrigin();
}

export function isLocalhostOrigin(origin: string): boolean {
  return LOCALHOST_ORIGIN_RE.test(origin);
}

export function isOriginAllowed(origin: string | undefined | null): boolean {
  if (origin == null || origin === "") {
    return true;
  }

  const configured = getConfiguredCorsOrigin();
  if (origin === configured) {
    return true;
  }

  return isLocalhostOrigin(origin) && isLocalhostOrigin(configured);
}
