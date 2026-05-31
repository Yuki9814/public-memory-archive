export type ApiListenConfig = {
  host: string;
  port: number;
};

export function getApiListenConfig(): ApiListenConfig {
  return {
    host: parseHost(process.env.API_HOST, "0.0.0.0"),
    port: parsePort(process.env.API_PORT, 4100)
  };
}

function parseHost(raw: string | undefined, fallback: string) {
  if (typeof raw !== "string") {
    return fallback;
  }

  const trimmed = raw.trim();
  return trimmed || fallback;
}

function parsePort(raw: string | undefined, fallback: number) {
  if (typeof raw !== "string") {
    return fallback;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }

  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    return fallback;
  }

  return value;
}
