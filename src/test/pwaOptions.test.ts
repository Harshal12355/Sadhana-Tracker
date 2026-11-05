import { describe, expect, it } from 'vitest';
import {
  pwaDevOptions,
  pwaIncludeAssets,
  pwaManifest,
  pwaRegisterType,
  pwaWorkbox,
} from '../pwa/pwaOptions';

const calendarUrl = 'http://127.0.0.1:8000/api/calendar?year=2026&month=11&city_id=nyc';
const youtubeApi = 'http://127.0.0.1:8000/api/youtube/resolve?url=abc';
const youtubeWatch = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const googlevideo = 'https://rr3---sn.googlevideo.com/videoplayback?id=1';
const fontCss = 'https://fonts.googleapis.com/css2?family=Inter&display=swap';
const fontFile = 'https://fonts.gstatic.com/s/inter/v1/abc.woff2';
const fontshare = 'https://api.fontshare.com/v2/css?f[]=satoshi@400&display=swap';
const fontshareFile = 'https://cdn.fontshare.com/wf/abc.woff2';

describe('pwa options', () => {
  it('uses the approved name card and stays quiet in dev', () => {
    expect(pwaRegisterType).toBe('autoUpdate');
    expect(pwaDevOptions).toEqual({ enabled: false });
    expect(pwaManifest.name).toBe('Sadhana Valli');
    expect(pwaManifest.short_name).toBe('Sadhana');
    expect(pwaManifest.display).toBe('standalone');
    expect(pwaManifest.start_url).toBe('/');
    expect(pwaManifest.scope).toBe('/');
    expect(pwaManifest.theme_color).toBe('#0c0d0c');
    expect(pwaManifest.background_color).toBe('#0c0d0c');
    expect(pwaIncludeAssets).toEqual([
      'apple-touch-icon.png',
      'pwa-192x192.png',
      'pwa-512x512.png',
    ]);
    expect(pwaManifest.icons).toEqual([
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
  });

  it('skips the app shell for API navigations', () => {
    expect(pwaWorkbox.globPatterns).toEqual([
      '**/*.{js,css,html,ico,png,svg,woff2,webmanifest}',
    ]);
    expect(pwaWorkbox.navigateFallback).toBe('index.html');
    expect(pwaWorkbox.navigateFallbackDenylist.some((re) => re.test('/api/health'))).toBe(true);
    expect(pwaWorkbox.navigateFallbackDenylist.some((re) => re.test('/api/calendar'))).toBe(true);
    expect(pwaWorkbox.navigateFallbackDenylist.some((re) => re.test('/'))).toBe(false);
  });

  it('remembers calendar and fonts, and skips youtube', () => {
    const patterns = pwaWorkbox.runtimeCaching.map((entry) => entry.urlPattern);
    const hit = (url: string) => patterns.filter((re) => re.test(url)).length;

    expect(hit(calendarUrl)).toBe(1);
    expect(hit('http://127.0.0.1:8000/api/calendar/import-ics')).toBe(0);
    expect(hit(youtubeApi)).toBe(0);
    expect(hit(youtubeWatch)).toBe(0);
    expect(hit(googlevideo)).toBe(0);
    expect(hit(fontCss)).toBe(1);
    expect(hit(fontFile)).toBe(1);
    expect(hit(fontshare)).toBe(1);
    expect(hit(fontshareFile)).toBe(1);

    const fontshareRule = pwaWorkbox.runtimeCaching.find((entry) =>
      entry.urlPattern.test(fontshareFile)
    );
    expect(fontshareRule?.options.cacheableResponse).toEqual({ statuses: [0, 200] });

    const calendar = pwaWorkbox.runtimeCaching.find((entry) => entry.urlPattern.test(calendarUrl));
    expect(calendar?.handler).toBe('NetworkFirst');
    expect(calendar?.method).toBe('GET');
    expect(calendar?.options.cacheName).toBe('calendar-api');
    expect(calendar?.options.networkTimeoutSeconds).toBe(3);
  });
});
