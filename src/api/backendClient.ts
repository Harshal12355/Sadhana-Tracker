import {
  DEFAULT_VAISHNAVA_CALENDAR_NOV_2026,
  extractYouTubeId,
  getYouTubeThumbUrl,
  parseVaishnavaIcs,
  type VaishnavaEvent,
} from '../sadhanaData';

const REQUEST_TIMEOUT_MS = 5000;

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCalendarMonth(
  year: number,
  month: number,
  cityId: string
): Promise<VaishnavaEvent[]> {
  try {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      city_id: cityId,
    });
    const res = await apiFetch(`/api/calendar?${params.toString()}`);
    const data = (await res.json()) as { events: VaishnavaEvent[] };
    if (!Array.isArray(data.events)) throw new Error('Bad calendar payload');
    return data.events;
  } catch {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    return DEFAULT_VAISHNAVA_CALENDAR_NOV_2026.filter((e) => e.date.startsWith(prefix));
  }
}

export async function importCalendarIcsViaApi(
  icsText: string,
  cityId: string
): Promise<VaishnavaEvent[]> {
  try {
    const res = await apiFetch('/api/calendar/import-ics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icsText, cityId }),
    });
    const data = (await res.json()) as { events: VaishnavaEvent[] };
    if (!Array.isArray(data.events)) throw new Error('Bad import payload');
    return data.events;
  } catch {
    return parseVaishnavaIcs(icsText);
  }
}

export async function resolveYouTubeViaApi(
  urlOrId: string
): Promise<{ youtubeId: string; title: string; speaker: string; thumbnailUrl: string } | null> {
  try {
    const res = await apiFetch(`/api/youtube/resolve?url=${encodeURIComponent(urlOrId)}`);
    const data = (await res.json()) as {
      youtubeId: string;
      title: string;
      speaker: string;
      thumbnailUrl: string;
    };
    if (!data.youtubeId) throw new Error('Bad resolve payload');
    return {
      youtubeId: data.youtubeId,
      title: data.title,
      speaker: data.speaker,
      thumbnailUrl: data.thumbnailUrl,
    };
  } catch {
    const youtubeId = extractYouTubeId(urlOrId);
    if (!youtubeId) return null;
    return { youtubeId, title: '', speaker: '', thumbnailUrl: getYouTubeThumbUrl(youtubeId) };
  }
}
