import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ISKCON_CITIES,
  INITIAL_SADHANA_HISTORY,
  formatParanaForCity,
  parseVaishnavaIcs,
  extractYouTubeId,
  getYouTubeThumbUrl,
  countCompletedRounds,
  sumReadingMinutes,
  sumReadingPages,
  sumLectureMinutes,
} from '../sadhanaData';
import {
  fetchCalendarMonth,
  importCalendarIcsViaApi,
  resolveYouTubeViaApi,
} from '../api/backendClient';
import { LoginScreen } from '../components/LoginScreen';
import { App } from '../App';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sadhanaData helpers & parity with Python backend', () => {
  it('wraps Parana time cleanly across midnight when city shift is negative', () => {
    const mayapur = ISKCON_CITIES.find((c) => c.id === 'may')!;
    expect(formatParanaForCity(['00:15', '09:00'], mayapur)).toBe(
      '23:40 – 08:25 (Sri Mayapur Candrodaya Mandir)'
    );
    expect(formatParanaForCity(null, mayapur)).toBeNull();
  });

  it('ignores VALARM descriptions when parsing .ics files on the client', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20261213',
      'SUMMARY:Gita Jayanti',
      'BEGIN:VALARM',
      'DESCRIPTION:Parana alarm text',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');

    const events = parseVaishnavaIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0].festival).toBe('Gita Jayanti');
    expect(events[0].fastingNote).toBeNull();
    expect(events[0].type).toBe('festival');
  });

  it('computes daily totals and YouTube URLs accurately', () => {
    const rec = INITIAL_SADHANA_HISTORY[0];
    expect(countCompletedRounds(rec)).toBe(12);
    expect(sumReadingMinutes(rec)).toBe(35);
    expect(sumReadingPages(rec)).toBe(11);
    expect(sumLectureMinutes(rec)).toBe(70);
    expect(extractYouTubeId('https://www.youtube.com/shorts/fbm_O3pD_3c')).toBe('fbm_O3pD_3c');
    expect(getYouTubeThumbUrl('fbm_O3pD_3c')).toBe(
      'https://i.ytimg.com/vi/fbm_O3pD_3c/hqdefault.jpg'
    );
  });
});

describe('backendClient HTTP happy paths & validation fallbacks', () => {
  it('returns API events when /api/calendar responds 200 OK', async () => {
    const mockEvents = [
      {
        date: '2026-12-01',
        tithi: 'Dvadashi',
        paksha: 'Krsna',
        masa: 'Kesava',
        festival: 'Utpanna Ekadashi Parana',
        type: 'parana',
        fastingNote: null,
        paranaBaseWindow: ['06:30', '10:15'],
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ events: mockEvents }),
      })
    );
    const res = await fetchCalendarMonth(2026, 12, 'nyc');
    expect(res).toEqual(mockEvents);
  });

  it('imports .ics via POST /api/calendar/import-ics and falls back on HTTP 422', async () => {
    const sampleIcs =
      'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261116\nSUMMARY:Utthana Ekadashi\nEND:VEVENT\nEND:VCALENDAR';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
      })
    );
    const fallbackEvents = await importCalendarIcsViaApi(sampleIcs, 'nyc');
    expect(fallbackEvents).toHaveLength(1);
    expect(fallbackEvents[0].type).toBe('ekadashi');
  });

  it('resolves YouTube metadata via GET /api/youtube/resolve on 200 OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          youtubeId: 'fbm_O3pD_3c',
          title: 'BG 9.14 Lecture',
          speaker: 'Srila Prabhupada',
          thumbnailUrl: 'https://i.ytimg.com/vi/fbm_O3pD_3c/hqdefault.jpg',
        }),
      })
    );
    const resolved = await resolveYouTubeViaApi('https://youtu.be/fbm_O3pD_3c');
    expect(resolved).toEqual({
      youtubeId: 'fbm_O3pD_3c',
      title: 'BG 9.14 Lecture',
      speaker: 'Srila Prabhupada',
      thumbnailUrl: 'https://i.ytimg.com/vi/fbm_O3pD_3c/hqdefault.jpg',
    });
  });
});

describe('LoginScreen and App SSR/component rendering', () => {
  it('renders LoginScreen with Google CTA, Email/Password form, Local Mode CTA, and .env guidance when unconfigured', () => {
    const html = renderToStaticMarkup(
      <LoginScreen
        firebaseConfigured={false}
        onGoogleSignIn={async () => {}}
        onEmailAuth={async () => {}}
        onContinueLocal={() => {}}
        authError="Popup blocked by browser"
        isSigningIn={false}
        theme="light"
        onToggleTheme={() => {}}
      />
    );
    expect(html).toContain('Hare Krishna. Begin today’s Japa.');
    expect(html).toContain('Continue with Google');
    expect(html).toContain('Sign in with Email');
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain('Continue in Local Offline Mode');
    expect(html).toContain('Popup blocked by browser');
    expect(html).toContain('VITE_FIREBASE_*');
  });

  it('renders App initial login gate when unauthenticated', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Sadhana Valli');
    expect(html).toContain('Continue in Local Offline Mode');
  });
});
