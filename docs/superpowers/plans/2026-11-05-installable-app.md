# Installable App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production Sadhana Valli site installable on a laptop and a phone, and make that installed icon open and save today's rounds with no signal.

**Architecture:** `vite-plugin-pwa` precaches the built page and remembers successful `GET /api/calendar` responses. Daily logs stay in the existing `localStorage` and Firestore offline cache. FastAPI serves the manifest, service worker, and icons from the static directory without taking over `/api/*`.

**Tech Stack:** Vite 6, `vite-plugin-pwa`, TypeScript, Vitest, FastAPI, the existing Docker image that serves `dist/`.

**Spec:** `docs/superpowers/specs/2026-11-05-installable-app-design.md`

## Global Constraints

- Plugin: `vite-plugin-pwa`, `registerType: 'autoUpdate'`. The dev server (`npm run dev`) does not register the helper. The production build does.
- Name card: name `Sadhana Valli`, short name `Sadhana`, `display: standalone`, `start_url: /`, `scope: /`. `theme_color` and `background_color` are `#0c0d0c`.
- Icons: 192 and 512 PNGs, one maskable 512 (same 512 file), and `apple-touch-icon.png` at 180. Dark square `#0c0d0c` (`rgb(12, 13, 12)`), teal circle `#2e9b8f` (`rgb(46, 155, 143)`) whose diameter is half the icon.
- iOS tags in `index.html`: `apple-mobile-web-app-capable` = `yes`, status bar `black-translucent`, title `Sadhana`, touch icon `/apple-touch-icon.png`.
- Precache the built page. `GET /api/calendar` is network-first, then the saved copy, with `networkTimeoutSeconds: 3` (the page aborts API calls at 5 seconds). Do not cache YouTube, `googlevideo`, or `POST`. Font stylesheets from `fonts.googleapis.com`, `fonts.gstatic.com`, and `api.fontshare.com` are cache-first after the first load.
- `GET /` stays the app. `/api/*` stays the API. A missing static file is 404, not `index.html`. Manifest responses use `application/manifest+json`. The service worker is `/sw.js`.
- `Dockerfile` copies `public/` before `npm run build`.
- Do not add a new host, and do not change how logs are stored.

## Review Focus

1. **A static path that climbs out of `dist/` (`../secret.txt`)** must return no file. A person must not be able to read the repo next to the static directory. (Pinned in Task 1 `test_resolve_static_file_rejects_parent_traversal`)
2. **A missing helper (`/sw-missing.js`)** must be HTTP 404, not the HTML app. Browsers reject a service worker whose body is HTML. (Pinned in Task 1 `test_serves_pwa_files_and_leaves_api_alone`)
3. **`/api/health` while static files exist** must stay the JSON health payload. The new file route must not swallow the API. (Pinned in Task 1 `test_serves_pwa_files_and_leaves_api_alone`)
4. **A YouTube or googlevideo URL** must match no runtime-cache rule. Offline video playback is out of scope, and caching those URLs would fill the phone. (Pinned in Task 3, test name `remembers calendar and fonts, and skips youtube`)
5. **A navigation to `/api/health`** must not be replaced by `index.html` when the helper is offline. The denylist has to match `/api/*`. (Pinned in Task 3, test name `skips the app shell for API navigations`)

---

### Task 1: Serve the name card and helper from FastAPI

**Files:**
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `create_app(static_dir: Path | None = None) -> FastAPI` already in `backend/app/main.py`.
- Produces: `resolve_static_file(root: Path, asset_path: str) -> Path | None`. Returns the resolved file when it is a file inside `root`. Returns `None` when the path is missing or not inside `root`.

- [ ] **Step 1: Write the failing tests**

Add this import to the existing import of `app.main` in `backend/tests/test_api.py`:

```python
from app.main import app, create_app, resolve_static_file
```

Append:

```python
def test_resolve_static_file_rejects_parent_traversal(tmp_path: Path):
    root = tmp_path / "dist"
    root.mkdir()
    (root / "sw.js").write_text("/* sw */", encoding="utf-8")
    secret = tmp_path / "secret.txt"
    secret.write_text("nope", encoding="utf-8")

    assert resolve_static_file(root, "sw.js") == (root / "sw.js").resolve()
    assert resolve_static_file(root, "../secret.txt") is None
    assert resolve_static_file(root, "foo/../../secret.txt") is None
    assert resolve_static_file(root, "missing.js") is None


def test_serves_pwa_files_and_leaves_api_alone(tmp_path: Path):
    (tmp_path / "index.html").write_text("<!doctype html><title>Sadhana Valli</title>", encoding="utf-8")
    (tmp_path / "manifest.webmanifest").write_text('{"name":"Sadhana Valli"}', encoding="utf-8")
    (tmp_path / "sw.js").write_text("/* sw */", encoding="utf-8")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log('sadhana');", encoding="utf-8")

    spa_client = TestClient(create_app(static_dir=tmp_path))

    manifest = spa_client.get("/manifest.webmanifest")
    assert manifest.status_code == 200
    assert manifest.headers["content-type"].startswith("application/manifest+json")
    assert manifest.json()["name"] == "Sadhana Valli"

    sw = spa_client.get("/sw.js")
    assert sw.status_code == 200
    assert "/* sw */" in sw.text

    missing = spa_client.get("/sw-missing.js")
    assert missing.status_code == 404
    assert "Sadhana Valli" not in missing.text

    health = spa_client.get("/api/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok", "service": "sadhana-valli-api"}

    asset = spa_client.get("/assets/app.js")
    assert asset.status_code == 200
    assert "console.log('sadhana');" in asset.text
```

- [ ] **Step 2: Run the tests to verify they fail**

From the repo root:

Run: `backend/.venv/bin/pytest backend/tests/test_api.py::test_resolve_static_file_rejects_parent_traversal backend/tests/test_api.py::test_serves_pwa_files_and_leaves_api_alone -v`

Expected: FAIL because `resolve_static_file` is not defined.

- [ ] **Step 3: Implement `resolve_static_file` and a catch-all file route**

Add `resolve_static_file(root: Path, asset_path: str) -> Path | None` in `backend/app/main.py`. Resolve `root / asset_path`. Return that path only when it is a file and `root.resolve()` is the file or a parent of the file. Return `None` for a missing file, for `root` itself, and for any path that escapes `root`.

Inside the existing `if index_file.is_file():` block, after the `/assets` mount and `GET /`, register `GET /{asset_path:path}` (not in the OpenAPI schema). It uses `resolve_static_file`. `None` raises `HTTPException(status_code=404)`. Suffix `.webmanifest` uses `media_type="application/manifest+json"`. Leave every `/api` route registered before this catch-all. Keep `GET /` and the `/assets` mount as they are.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `backend/.venv/bin/pytest backend/tests/test_api.py -v`

Expected: PASS, including the two new tests and `test_serves_spa_frontend_when_static_dir_exists`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/tests/test_api.py
git commit -m "$(cat <<'EOF'
fix: serve the app manifest and service worker

The phone cannot install the site if FastAPI only serves the HTML shell and /assets.
EOF
)"
```

---

### Task 2: Draw the icon

**Files:**
- Create: `src/pwa/iconArt.ts`
- Create: `scripts/write-pwa-icons.ts`
- Create: `public/pwa-192x192.png`
- Create: `public/pwa-512x512.png`
- Create: `public/apple-touch-icon.png`
- Test: `src/test/pwaIcon.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `renderIconPixels(size: number): Uint8Array` — RGBA, length `size * size * 4`. Center is `(size / 2, size / 2)`. A pixel whose distance from the center is `<= size * 0.25` is `46, 155, 143, 255`. Every other pixel is `12, 13, 12, 255`.
  - `encodePng(width: number, height: number, rgba: Uint8Array): Buffer` — PNG signature, IHDR width and height, color type 6. Deflate rows with `node:zlib`. Each row starts with filter byte `0`.

- [ ] **Step 1: Write the failing test**

Create `src/test/pwaIcon.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { encodePng, renderIconPixels } from '../pwa/iconArt';

function pixel(buf: Uint8Array, size: number, x: number, y: number): number[] {
  const i = (y * size + x) * 4;
  return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
}

describe('pwa icon', () => {
  it('paints a teal circle on the dark chrome', () => {
    const size = 192;
    const buf = renderIconPixels(size);
    expect(buf).toHaveLength(size * size * 4);
    expect(pixel(buf, size, 0, 0)).toEqual([12, 13, 12, 255]);
    expect(pixel(buf, size, 96, 96)).toEqual([46, 155, 143, 255]);
    expect(pixel(buf, size, 0, 96)).toEqual([12, 13, 12, 255]);
  });

  it('encodes a PNG whose header matches the pixel buffer', () => {
    const size = 192;
    const png = encodePng(size, size, renderIconPixels(size));
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/pwaIcon.test.ts`

Expected: FAIL because `../pwa/iconArt` does not exist.

- [ ] **Step 3: Implement the two functions**

Create `src/pwa/iconArt.ts` with `renderIconPixels` and `encodePng` as specified in this task's Interfaces. PNG chunks are IHDR, one IDAT, IEND.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/pwaIcon.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the three PNG files**

Create `scripts/write-pwa-icons.ts` that calls `renderIconPixels` and `encodePng`, then writes:

- `public/apple-touch-icon.png` at 180
- `public/pwa-192x192.png` at 192
- `public/pwa-512x512.png` at 512

Run: `npx vite-node scripts/write-pwa-icons.ts`

Expected: those three files exist. `public/pwa-192x192.png` is a PNG (`file public/pwa-192x192.png` mentions PNG).

- [ ] **Step 6: Commit**

```bash
git add src/pwa/iconArt.ts src/test/pwaIcon.test.ts scripts/write-pwa-icons.ts public/apple-touch-icon.png public/pwa-192x192.png public/pwa-512x512.png
git commit -m "$(cat <<'EOF'
feat: add the Sadhana home-screen icon

Install needs a 192, a 512, and an Apple touch icon in the dark and teal already used by the app.
EOF
)"
```

---

### Task 3: Register the install helper on the production build

**Files:**
- Create: `src/pwa/pwaOptions.ts`
- Modify: `vite.config.ts`
- Modify: `index.html`
- Modify: `Dockerfile` (the frontend stage `COPY src ./src` is followed by `COPY public ./public`)
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `src/test/pwaOptions.test.ts`
- Test: `src/test/pwaShellFiles.test.ts`

**Interfaces:**
- Consumes: Task 2 filenames `apple-touch-icon.png`, `pwa-192x192.png`, `pwa-512x512.png` in `public/`.
- Produces, from `src/pwa/pwaOptions.ts`:
  - `pwaRegisterType: 'autoUpdate'`
  - `pwaDevOptions: { enabled: false }`
  - `pwaIncludeAssets: ['apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png']`
  - `pwaManifest` with the name-card fields in Global Constraints, `description: 'ISKCON daily sadhana almanac'`, and `icons`: `{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }`, `{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }`, `{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }`
  - `pwaWorkbox.globPatterns`: `['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}']`
  - `pwaWorkbox.navigateFallback`: `'index.html'`
  - `pwaWorkbox.navigateFallbackDenylist`: `[/^\/api\//]`
  - `pwaWorkbox.runtimeCaching`: three entries, each `urlPattern` a `RegExp`:
    1. `urlPattern` `/\/api\/calendar(?:\?|$)/`, `handler` `'NetworkFirst'`, `method` `'GET'`, `options.cacheName` `'calendar-api'`, `options.networkTimeoutSeconds` `3`, `options.expiration` `{ maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 30 }`
    2. `urlPattern` `/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//`, `handler` `'CacheFirst'`, `options.cacheName` `'google-fonts'`, `options.expiration` `{ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }`
    3. `urlPattern` `/^https:\/\/api\.fontshare\.com\//`, `handler` `'CacheFirst'`, `options.cacheName` `'fontshare'`, `options.expiration` `{ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }`

- [ ] **Step 1: Write the failing tests**

Create `src/test/pwaOptions.test.ts`:

```ts
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

    const calendar = pwaWorkbox.runtimeCaching.find((entry) => entry.urlPattern.test(calendarUrl));
    expect(calendar?.handler).toBe('NetworkFirst');
    expect(calendar?.method).toBe('GET');
    expect(calendar?.options.cacheName).toBe('calendar-api');
    expect(calendar?.options.networkTimeoutSeconds).toBe(3);
  });
});
```

Create `src/test/pwaShellFiles.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('pwa shell files', () => {
  it('tells iPhone to open as an app', () => {
    const html = readFileSync(resolve('index.html'), 'utf8');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Sadhana" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
  });

  it('copies public icons into the image build', () => {
    const dockerfile = readFileSync(resolve('Dockerfile'), 'utf8');
    expect(dockerfile).toContain('COPY public ./public');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/test/pwaOptions.test.ts src/test/pwaShellFiles.test.ts`

Expected: FAIL. `pwaOptions` is missing. `index.html` does not contain the Apple tags. `Dockerfile` does not copy `public/`.

- [ ] **Step 3: Install the plugin and export the options**

Run: `npm install -D vite-plugin-pwa`

Create `src/pwa/pwaOptions.ts` exporting the constants in this task's Interfaces so `src/test/pwaOptions.test.ts` passes.

In `vite.config.ts`, keep the React plugin and the `/api` proxy. Add `VitePWA` from `vite-plugin-pwa` with `registerType: pwaRegisterType`, `devOptions: pwaDevOptions`, `includeAssets: pwaIncludeAssets`, `manifest: pwaManifest`, and `workbox: pwaWorkbox`.

Add the four Apple tags from the shell test to `<head>` in `index.html`, after the viewport meta.

In `Dockerfile`, immediately after `COPY src ./src`, add `COPY public ./public`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/test/pwaOptions.test.ts src/test/pwaShellFiles.test.ts src/test/pwaIcon.test.ts`

Expected: PASS.

- [ ] **Step 5: Build and check the emitted app**

Run: `npm run build`

Then:

```bash
node --input-type=module -e "
import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync('dist/manifest.webmanifest','utf8'));
const sw = fs.readFileSync('dist/sw.js','utf8');
const index = fs.readFileSync('dist/index.html','utf8');
const checks = [
  manifest.name === 'Sadhana Valli',
  manifest.short_name === 'Sadhana',
  manifest.display === 'standalone',
  manifest.theme_color === '#0c0d0c',
  manifest.background_color === '#0c0d0c',
  manifest.start_url === '/',
  sw.includes('calendar-api'),
  index.includes('manifest.webmanifest'),
  index.includes('apple-mobile-web-app-capable'),
  fs.existsSync('dist/sw.js'),
  fs.existsSync('dist/pwa-192x192.png'),
  fs.existsSync('dist/apple-touch-icon.png'),
];
if (checks.some((ok) => !ok)) process.exit(1);
console.log('pwa build ok');
"
```

Expected: prints `pwa build ok` and exits 0.

- [ ] **Step 6: Serve that build through FastAPI**

From the repo root:

```bash
PYTHONPATH=backend backend/.venv/bin/python -c "
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import create_app
client = TestClient(create_app(static_dir=Path('dist').resolve()))
manifest = client.get('/manifest.webmanifest')
assert manifest.status_code == 200, manifest.status_code
assert manifest.headers['content-type'].startswith('application/manifest+json')
assert manifest.json()['short_name'] == 'Sadhana'
sw = client.get('/sw.js')
assert sw.status_code == 200 and 'workbox' in sw.text.lower()
health = client.get('/api/health')
assert health.json() == {'status': 'ok', 'service': 'sadhana-valli-api'}
print('fastapi pwa ok')
"
```

Expected: prints `fastapi pwa ok` and exits 0.

- [ ] **Step 7: Open the production preview once online, then once offline**

Run: `npx vite preview --host 127.0.0.1 --port 4173`

Open `http://127.0.0.1:4173/`, reload once, and check:

- `navigator.serviceWorker.controller` is set
- the manifest `name` is `Sadhana Valli` and `display` is `standalone`

Then set the browser offline and reload. Expected: the Sadhana workspace still renders. The browser's own "no internet" page does not. A `+1 Round` tap is still present after one more reload while offline.

Stop the preview server when the check is done.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/pwa/pwaOptions.ts src/test/pwaOptions.test.ts src/test/pwaShellFiles.test.ts vite.config.ts index.html Dockerfile
git commit -m "$(cat <<'EOF'
feat: install Sadhana Valli as an offline app

A production visit now saves the page, the icon, and calendar months that already loaded, and the dev server stays a normal website.
EOF
)"
```
