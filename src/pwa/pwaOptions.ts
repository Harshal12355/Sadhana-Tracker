export const pwaRegisterType = 'autoUpdate' as const;

export const pwaDevOptions = { enabled: false };

export const pwaIncludeAssets = [
  'apple-touch-icon.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
];

export const pwaManifest = {
  name: 'Sadhana Valli',
  short_name: 'Sadhana',
  description: 'ISKCON daily sadhana almanac',
  theme_color: '#0c0d0c',
  background_color: '#0c0d0c',
  display: 'standalone' as const,
  start_url: '/',
  scope: '/',
  icons: [
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' as const },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' as const },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' as const },
  ],
};

const monthSeconds = 60 * 60 * 24 * 30;
const yearSeconds = 60 * 60 * 24 * 365;

export const pwaWorkbox = {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
  navigateFallback: 'index.html',
  navigateFallbackDenylist: [/^\/api\//],
  runtimeCaching: [
    {
      urlPattern: /\/api\/calendar(?:\?|$)/,
      handler: 'NetworkFirst' as const,
      method: 'GET' as const,
      options: {
        cacheName: 'calendar-api',
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 24, maxAgeSeconds: monthSeconds },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,
      handler: 'CacheFirst' as const,
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 20, maxAgeSeconds: yearSeconds },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: /^https:\/\/(?:api|cdn)\.fontshare\.com\//,
      handler: 'CacheFirst' as const,
      options: {
        cacheName: 'fontshare',
        expiration: { maxEntries: 30, maxAgeSeconds: yearSeconds },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
};
