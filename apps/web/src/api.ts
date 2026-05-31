import type {
  ClaimDto,
  EventDetailDto,
  EventListItemDto,
  PlatformLinkDto,
  RevisionDto,
  SourceDto,
  TimelineEntryDto,
  SessionDto
} from "@memory-archive/shared";
import {
  mockClaims,
  mockDetails,
  mockEvents,
  mockPlatformLinks,
  mockSources,
  mockTimeline,
  mockVersions
} from "./mock.js";
import { normalizeApiBase } from "./normalize-api-base.js";

const apiBase = normalizeApiBase(import.meta.env.VITE_API_URL);

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { credentials: "include" });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function fetchEvents(): Promise<EventListItemDto[]> {
  try {
    const data = await getJson<{ items: EventListItemDto[] }>("/api/events?pageSize=20");
    return data.items;
  } catch {
    return mockEvents;
  }
}

export async function fetchEventDetail(slug: string): Promise<EventDetailDto | null> {
  try {
    return await getJson<EventDetailDto>(`/api/events/${slug}`);
  } catch {
    return mockDetails[slug] ?? null;
  }
}

export async function fetchPlatformLinks(slug: string): Promise<PlatformLinkDto[]> {
  try {
    const data = await getJson<{ items: PlatformLinkDto[] }>(`/api/events/${slug}/platform-links`);
    return data.items;
  } catch {
    return mockPlatformLinks[slug] ?? [];
  }
}

export async function fetchTimeline(slug: string): Promise<TimelineEntryDto[]> {
  try {
    const data = await getJson<{ items: TimelineEntryDto[] }>(`/api/events/${slug}/timeline?pageSize=50`);
    return data.items;
  } catch {
    return mockTimeline[slug] ?? [];
  }
}

export async function fetchClaims(slug: string): Promise<ClaimDto[]> {
  try {
    const data = await getJson<{ items: ClaimDto[] }>(`/api/events/${slug}/claims`);
    return data.items;
  } catch {
    return mockClaims[slug] ?? [];
  }
}

export async function fetchSources(slug: string): Promise<SourceDto[]> {
  try {
    const data = await getJson<{ items: SourceDto[] }>(`/api/events/${slug}/sources?pageSize=50`);
    return data.items;
  } catch {
    return mockSources[slug] ?? [];
  }
}

export async function fetchVersions(slug: string): Promise<RevisionDto[]> {
  try {
    const data = await getJson<{ items: RevisionDto[] }>(`/api/events/${slug}/versions`);
    return data.items;
  } catch {
    return mockVersions[slug] ?? [];
  }
}

export async function fetchSession(): Promise<SessionDto> {
  try {
    return await getJson<SessionDto>("/api/session");
  } catch {
    return { role: "GUEST" };
  }
}

export async function loginAdmin(passcode: string): Promise<SessionDto> {
  const response = await fetch(`${apiBase}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ passcode })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Login failed");
  }
  return response.json() as Promise<SessionDto>;
}

export async function logoutAdmin(): Promise<SessionDto> {
  const response = await fetch(`${apiBase}/api/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error("Logout failed");
  }
  return response.json() as Promise<SessionDto>;
}
