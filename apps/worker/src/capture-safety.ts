import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const DEFAULT_CAPTURE_TIMEOUT_MS = 12_000;
const DEFAULT_CAPTURE_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);
const MAX_REDIRECTS = 5;

export function getCaptureTimeoutMs() {
  return parsePositiveInteger(process.env.CAPTURE_TIMEOUT_MS, DEFAULT_CAPTURE_TIMEOUT_MS);
}

export function getCaptureMaxBytes() {
  return parsePositiveInteger(process.env.CAPTURE_MAX_BYTES, DEFAULT_CAPTURE_MAX_BYTES);
}

function parsePositiveInteger(raw: string | undefined, fallback: number) {
  const value = Number(raw?.trim());
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  const ipv4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Mapped) return isPrivateIpv4(ipv4Mapped[1] ?? "");
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  );
}

export function isBlockedIp(ip: string) {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

export async function assertSafeCaptureUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("CAPTURE_URL_INVALID");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("CAPTURE_URL_SCHEME_BLOCKED");
  if (url.username || url.password) throw new Error("CAPTURE_URL_CREDENTIALS_BLOCKED");
  if (!ALLOWED_PORTS.has(url.port)) throw new Error("CAPTURE_URL_PORT_BLOCKED");

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error("CAPTURE_URL_PRIVATE_IP_BLOCKED");
    return url;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => {
    throw new Error("CAPTURE_URL_DNS_BLOCKED");
  });
  if (addresses.length === 0 || addresses.some((entry) => isBlockedIp(entry.address))) {
    throw new Error("CAPTURE_URL_PRIVATE_IP_BLOCKED");
  }
  return url;
}

export async function safeFetch(url: string, init: RequestInit = {}, redirects = 0): Promise<Response> {
  if (redirects > MAX_REDIRECTS) throw new Error("CAPTURE_REDIRECT_LIMIT");
  const safeUrl = await assertSafeCaptureUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getCaptureTimeoutMs());
  try {
    const response = await fetch(safeUrl, {
      ...init,
      redirect: "manual",
      signal: controller.signal
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      return safeFetch(new URL(location, safeUrl).toString(), init, redirects + 1);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function readLimitedText(response: Response) {
  const contentLength = response.headers.get("content-length");
  const maxBytes = getCaptureMaxBytes();
  if (contentLength && Number(contentLength) > maxBytes) throw new Error("CAPTURE_RESPONSE_TOO_LARGE");
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error("CAPTURE_CONTENT_TYPE_BLOCKED");
  }
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("CAPTURE_RESPONSE_TOO_LARGE");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
