# Sadhana Valli — installable app (saved page)

## Intent

Harshal wants the same Sadhana Valli page as an icon on a laptop and on a phone, the way other sites offer Install or Add to Home Screen. With no signal, that icon still opens and `+1 Round` still saves today's log. He chose saving this website as the app. He did not choose an App Store or Play Store build.

## Goals

- Chromium (Chrome, Edge) on a laptop can install the site into its own window.
- iPhone can Add to Home Screen and open that icon without the Safari address bar.
- After one visit with signal, the icon opens with no signal. Rounds, reading, and the journal still save on the device.
- A calendar month that already loaded once still shows with no signal.
- When signal returns, the existing Firestore sync sends the logs up. No new sync system.

## Non-goals

- App Store, Play Store, or a native wrapper.
- Playing a YouTube video with no signal. A pasted link still saves. Title and speaker fill in when the network is back, which the app already does.
- A new public web address. This change does not deploy the site.

## Anti-goals

- A second copy of the logs. `localStorage` and the Firestore offline cache stay the source of truth.
- A spinner that blocks logging while the phone looks for a network.

## What already works

Daily logs are written to `localStorage` in `src/App.tsx`. Firestore is opened with `persistentLocalCache` in `src/firebase/config.ts`. The calendar request already falls back to the built-in November 2026 table in `src/api/backendClient.ts`. The missing piece is the page itself: HTML, JS, and CSS are fetched on every visit, and nothing tells the browser this site is an app.

## Approaches

1. **Chosen — save this website as the app.** `vite-plugin-pwa` writes the name card (web app manifest), the icons, and a helper (service worker) that keeps a copy of the built page on the device. About 2 hours. Fits the Vite build and the existing offline logs.
2. **Rejected — App Store wrapper.** Days of native tooling and store review. Harshal asked for the webpage, saved like the other apps on his phone.
3. **Rejected — a hand-written helper.** Vite renames files on every build, so a hand-written list of files to save goes stale.

## How it gets built

These are builder calls. Correct them if they are wrong.

- Plugin: `vite-plugin-pwa`, `registerType: 'autoUpdate'`. The dev server (`npm run dev`) does not register the helper. The production build does.
- Name card: name `Sadhana Valli`, short name `Sadhana`, `display: standalone`, `start_url: /`, `scope: /`. `theme_color` and `background_color` are `#0c0d0c` (the existing dark chrome).
- Icons: generated 192 and 512 PNGs, plus one maskable 512 and one Apple touch icon. Dark square, teal mark (`#2e9b8f`). No separate illustration pass.
- `index.html` gets the Apple tags so iPhone opens it as an app: capable, status bar, touch icon.
- The helper precaches the built page (JS, CSS, HTML, icons). It remembers successful `GET /api/calendar` responses (network first, then the saved copy) so a month that loaded once still shows. It does not cache `POST` requests or YouTube video bytes. Font stylesheets from Google Fonts and Fontshare are saved after the first successful load. If they are missing, the page still opens in a system font.
- The helper is off in `vite` dev. Check it with `vite preview` and with the FastAPI server that serves `dist/`.

## Server constraint

`backend/app/main.py` only serves `/` and `/assets/*`. The name card and the helper are files next to `index.html` (`manifest.webmanifest`, `sw.js`, icons). FastAPI must serve any real file in the static directory, keep `/api/*` as the API, and keep `/` as the app. The manifest response uses `application/manifest+json`. The service worker stays at the site root so its scope is the whole app.

`Dockerfile` copies `vite.config.ts` and `index.html` but not a `public/` folder. The image build must copy `public/` so the icons are in the image.

## Limit

A phone will only offer Install or keep the helper alive on `https://` (or on the laptop's `localhost`). An address like `http://192.168.x.x:8000` does not count. This change makes the built site installable. It does not create that https address. Laptop install works on `localhost` as soon as the build is done.

## Done when

1. A production build emits the name card, icons, and helper.
2. Opening that build on `localhost` shows an install affordance in Chrome, and the installed window has no address bar.
3. After one load, DevTools "Offline" still opens the app and a `+1 Round` is still in `localStorage` after reload.
4. `GET /manifest.webmanifest` and `GET /sw.js` return 200 from the FastAPI app. `GET /api/health` still returns the health JSON.
5. A calendar month fetched once still renders when the next load is offline.
