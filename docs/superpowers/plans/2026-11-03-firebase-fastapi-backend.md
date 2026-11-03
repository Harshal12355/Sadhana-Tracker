# Sadhana Valli — Firebase Auth, Firestore Sync & Python FastAPI Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Google Sign-In login gate, offline-first Cloud Firestore per-user sync (`users/{uid}`), and a Python FastAPI backend (`/api/*`) for Vaishnava calendar & Parana calculations, `.ics` imports, and YouTube metadata resolution.

**Architecture:** The React frontend (`src/`) uses the Firebase Web SDK (`firebase/auth` and `firebase/firestore` with `persistentLocalCache`) for Google authentication and 0ms offline-capable Sadhana record persistence under `users/{uid}/days/{YYYY-MM-DD}`. A Python FastAPI service (`backend/app/`) connected through a Vite `/api` proxy computes Vaishnava calendar months, temple-city Parana windows, `.ics` event imports, and YouTube oEmbed metadata, while the frontend falls back to local `src/sadhanaData.ts` logic whenever offline.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest, Firebase Web SDK v11 (`firebase/auth`, `firebase/firestore`), Python 3.11+, FastAPI, Pydantic v2, HTTPX, Pytest.

**Spec:** `docs/superpowers/specs/2026-11-03-firebase-fastapi-backend-design.md`

## Global Constraints

- Python runtime: Python 3.11+ in `backend/.venv` with `fastapi`, `uvicorn`, `httpx`, `pydantic`, and `pytest`.
- Frontend packages: `firebase` (v11+) for Auth & Firestore, `vitest` for unit testing sync/merge and API utilities.
- Design preservation: Do not alter the existing 12-column layout, color tokens, or typography rules in `DESIGN.md` and `src/styles.css`; only add scoped styles for `LoginScreen` and the auth status controls.
- Zero-Breakage Offline Fallback: If the FastAPI server or network is unreachable, the React frontend falls back cleanly to local calculations in `src/sadhanaData.ts`.
- Never block morning Japa chanting behind network spinners or broken API calls.

## Review Focus

1. **Parana time shift across midnight (`paranaShiftMinutes` negative or large positive)**: Shifting an early Base Parana window (e.g. `00:15` with `-35` minutes) must wrap cleanly within `00:00`–`23:59` instead of producing negative hours like `-1:40`. (Pinned in Task 1 `test_format_parana_for_city_wraps_midnight`)
2. **Out-of-range calendar query parameters (`month=0`, `month=13`, `year=1999`)**: `GET /api/calendar` must reject invalid months or years outside `2020..2035` with HTTP `422` instead of crashing `calendar.monthrange`. (Pinned in Task 2 `test_get_calendar_rejects_out_of_range_params`)
3. **Empty or non-VEVENT `.ics` upload**: `POST /api/calendar/import-ics` with blank text or a file lacking `BEGIN:VEVENT` must return HTTP `422` with a clear detail message instead of wiping the user's calendar with an empty array. (Pinned in Task 2 `test_import_ics_rejects_empty_or_invalid_payload`)
4. **Upstream `noembed.com` timeout or HTTP 500 during YouTube resolution**: `GET /api/youtube/resolve` must catch `httpx.HTTPError` / timeouts and still return a valid `200 OK` fallback payload with the extracted 11-char `youtubeId` and thumbnail URL so the user can save their lecture offline. (Pinned in Task 2 `test_resolve_youtube_survives_upstream_failure`)
5. **Same-day reflection & readings merge when one device has an empty reflection**: `mergeDailyRecords(local, remote)` must never overwrite a non-empty `reflection` with an empty string `""` even if the empty record has a newer `updatedAt` timestamp from a quick `+1 Round` tap on another device. (Pinned in Task 3 `test_merge_daily_records_preserves_non_empty_reflection_and_unions_items`)

---

### Task 1: Python Vaishnava Calendar, Parana & `.ics` Engine

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/models.py`
- Create: `backend/app/calendar_engine.py`
- Test: `backend/tests/test_calendar.py`

**Interfaces:**
- Produces:
  - `backend/app/models.py`:
    - `IskconCity(BaseModel)`: `id: str`, `name: str`, `country: str`, `paranaShiftMinutes: int`
    - `VaishnavaEventModel(BaseModel)`: `date: str`, `tithi: str`, `paksha: Literal['Krsna', 'Gaura']`, `masa: str`, `festival: str | None`, `type: Literal['ekadashi', 'parana', 'festival', 'regular']`, `fastingNote: str | None`, `paranaBaseWindow: tuple[str, str] | None`, `paranaWindow: str | None = None`
    - `CalendarMonthResponse(BaseModel)`: `year: int`, `month: int`, `city: IskconCity`, `events: list[VaishnavaEventModel]`, `nextEkadashi: VaishnavaEventModel`
    - `IcsImportRequest(BaseModel)`: `icsText: str`, `cityId: str = 'nyc'`
    - `IcsImportResponse(BaseModel)`: `importedCount: int`, `events: list[VaishnavaEventModel]`
  - `backend/app/calendar_engine.py`:
    - `ISKCON_CITIES: list[IskconCity]`
    - `get_city_by_id(city_id: str) -> IskconCity`
    - `format_parana_for_city(base_window: tuple[str, str] | None, city: IskconCity) -> str | None`
    - `get_calendar_month(year: int, month: int, city_id: str = 'nyc', reference_date: str | None = None) -> CalendarMonthResponse`
    - `parse_vaishnava_ics(ics_text: str, city_id: str = 'nyc') -> list[VaishnavaEventModel]`

- [ ] **Step 1: Create `backend/pyproject.toml` and virtual environment with dependencies**

Create `backend/pyproject.toml` declaring project `sadhana-valli-backend`, Python `>=3.11`, dependencies `["fastapi>=0.115.0", "uvicorn>=0.32.0", "pydantic>=2.9.0", "httpx>=0.27.0"]`, and optional dev dependency `["pytest>=8.3.0"]`.

Run: `python3 -m venv backend/.venv && backend/.venv/bin/pip install -e "backend[dev]"`
Expected: Successfully installed `fastapi`, `uvicorn`, `pydantic`, `httpx`, `pytest`.

- [ ] **Step 2: Write the failing calendar & `.ics` unit tests in `backend/tests/test_calendar.py`**

```python
from app.calendar_engine import (
    format_parana_for_city,
    get_calendar_month,
    get_city_by_id,
    parse_vaishnava_ics,
)


def test_november_2026_returns_canonical_gaurabda_540_events():
    res = get_calendar_month(2026, 11, "nyc", reference_date="2026-11-02")
    assert res.year == 2026
    assert res.month == 11
    assert res.city.id == "nyc"
    assert len(res.events) == 30
    assert res.events[0].date == "2026-11-01"
    assert res.events[0].type == "ekadashi"
    assert "Rama Ekadashi" in (res.events[0].festival or "")
    assert res.events[1].date == "2026-11-02"
    assert res.events[1].paranaWindow == "06:24 – 10:18 (New York)"
    assert res.nextEkadashi.date == "2026-11-16"


def test_format_parana_for_city_wraps_midnight():
    mayapur = get_city_by_id("may")  # paranaShiftMinutes = -35
    shifted = format_parana_for_city(("00:15", "09:00"), mayapur)
    assert shifted == "23:40 – 08:25 (Sri Mayapur Candrodaya Mandir)"


def test_algorithmic_month_generates_ekadashi_and_parana_pairs():
    res = get_calendar_month(2026, 12, "lon")
    assert len(res.events) == 31
    ekadashis = [e for e in res.events if e.type == "ekadashi"]
    paranas = [e for e in res.events if e.type == "parana"]
    assert len(ekadashis) >= 2
    assert len(paranas) >= 1
    assert all("London" in (p.paranaWindow or "") for p in paranas)


def test_parse_vaishnava_ics_extracts_vevents_and_classifies_types():
    sample_ics = (
        "BEGIN:VCALENDAR\n"
        "BEGIN:VEVENT\n"
        "DTSTART;VALUE=DATE:20261211\n"
        "SUMMARY:Moksada Ekadashi\\, Fast\n"
        "DESCRIPTION:Complete fast from grains\\nObserve Gita Jayanti\n"
        "END:VEVENT\n"
        "BEGIN:VEVENT\n"
        "DTSTART:20261212\n"
        "SUMMARY:Break fast (Parana)\n"
        "DESCRIPTION:Parana window\n"
        "END:VEVENT\n"
        "END:VCALENDAR"
    )
    events = parse_vaishnava_ics(sample_ics, city_id="nyc")
    assert len(events) == 2
    assert events[0].date == "2026-12-11"
    assert events[0].type == "ekadashi"
    assert events[0].festival == "Moksada Ekadashi, Fast"
    assert events[1].date == "2026-12-12"
    assert events[1].type == "parana"
    assert events[1].paranaWindow == "06:30 – 10:15 (New York)"
```

- [ ] **Step 3: Run `pytest` to verify the tests fail**

Run: `backend/.venv/bin/pytest backend/tests/test_calendar.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.calendar_engine'`

- [ ] **Step 4: Implement `backend/app/models.py` and `backend/app/calendar_engine.py`**

Implement the Pydantic models in `backend/app/models.py` and the calendar engine in `backend/app/calendar_engine.py`:
- Copy the 6 `ISKCON_CITIES` and 30 `DEFAULT_VAISHNAVA_CALENDAR_NOV_2026` entries from `src/sadhanaData.ts`.
- In `format_parana_for_city`, compute `total = (h * 60 + m + delta_mins) % 1440` so negative shifts wrap around `00:00`–`23:59`, and format as `"{start} – {end} ({city_short_name})"` where `city_short_name = city.name.split(" (")[0]`.
- For non-November-2026 months, anchor lunar day calculation to `2026-11-05` (Amavasya, end of Krsna Paksha) using a 30-tithi cycle across the 15 `TITHI_NAMES` (`Pratipada`..`Chaturdashi`, plus `Amavasya` for Krsna 15 and `Purnima` for Gaura 15) and map each calendar month to its Vaishnava Masa (`Damodara`, `Kesava`, `Narayana`, `Madhava`, `Govinda`, `Visnu`, `Madhusudana`, `Trivikrama`, `Vamana`, `Sridhara`, `Hrsikesa`, `Padmanabha`). Mark `tithi == 'Ekadashi'` as `type='ekadashi'` and the day after as `type='parana'` with `paranaBaseWindow=('06:30', '10:15')`.

- [ ] **Step 5: Run `pytest` to verify all calendar tests pass**

Run: `backend/.venv/bin/pytest backend/tests/test_calendar.py -v`
Expected: `4 passed`

- [ ] **Step 6: Commit Task 1**

```bash
git add backend/pyproject.toml backend/app/__init__.py backend/app/models.py backend/app/calendar_engine.py backend/tests/test_calendar.py
git commit -m "feat(backend): add Vaishnava calendar, Parana, and .ics engine"
```

---

### Task 2: Python YouTube Metadata Resolver & FastAPI Endpoints

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/app/youtube_resolver.py`
- Create: `backend/app/main.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `backend/app/calendar_engine.py`, `backend/app/models.py`
- Produces:
  - `backend/app/models.py`:
    - `YouTubeResolveResponse(BaseModel)`: `youtubeId: str`, `youtubeUrl: str`, `title: str`, `speaker: str`, `thumbnailUrl: str`
  - `backend/app/youtube_resolver.py`:
    - `extract_youtube_id(raw_input: str) -> str | None`
    - `resolve_youtube_metadata(raw_input: str, client: httpx.Client | None = None) -> YouTubeResolveResponse`
  - `backend/app/main.py`:
    - `app = FastAPI(title="Sadhana Valli API")` exposing `GET /api/health`, `GET /api/cities`, `GET /api/calendar`, `POST /api/calendar/import-ics`, `GET /api/youtube/resolve`

- [ ] **Step 1: Write the failing FastAPI and YouTube resolver tests in `backend/tests/test_api.py`**

```python
import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.youtube_resolver import extract_youtube_id, resolve_youtube_metadata

client = TestClient(app)


def test_health_and_cities_endpoints():
    r_health = client.get("/api/health")
    assert r_health.status_code == 200
    assert r_health.json() == {"status": "ok", "service": "sadhana-valli-api"}

    r_cities = client.get("/api/cities")
    assert r_cities.status_code == 200
    cities = r_cities.json()["cities"]
    assert len(cities) == 6
    assert cities[0]["id"] == "nyc"


def test_get_calendar_endpoint_and_rejects_out_of_range_params():
    ok = client.get("/api/calendar?year=2026&month=11&city_id=may")
    assert ok.status_code == 200
    body = ok.json()
    assert body["city"]["id"] == "may"
    assert len(body["events"]) == 30

    bad_month = client.get("/api/calendar?year=2026&month=13")
    assert bad_month.status_code == 422

    bad_year = client.get("/api/calendar?year=1999&month=11")
    assert bad_year.status_code == 422


def test_import_ics_endpoint_and_rejects_empty_or_invalid_payload():
    bad = client.post("/api/calendar/import-ics", json={"icsText": "not an ics file", "cityId": "nyc"})
    assert bad.status_code == 422

    valid_ics = (
        "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261116\n"
        "SUMMARY:Utthana Ekadashi\nEND:VEVENT\nEND:VCALENDAR"
    )
    good = client.post("/api/calendar/import-ics", json={"icsText": valid_ics, "cityId": "nyc"})
    assert good.status_code == 200
    assert good.json()["importedCount"] == 1


def test_extract_youtube_id_and_reject_invalid():
    assert extract_youtube_id("https://www.youtube.com/watch?v=fbm_O3pD_3c") == "fbm_O3pD_3c"
    assert extract_youtube_id("https://youtu.be/kR8BfG8D1qU?t=12") == "kR8BfG8D1qU"
    assert extract_youtube_id("v7w5N7w9K2c") == "v7w5N7w9K2c"
    assert extract_youtube_id("https://example.com/not-youtube") is None

    bad_resp = client.get("/api/youtube/resolve?url=not-a-valid-url")
    assert bad_resp.status_code == 422


def test_resolve_youtube_survives_upstream_failure():
    def failing_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("Simulated timeout")

    mock_client = httpx.Client(transport=httpx.MockTransport(failing_handler))
    resolved = resolve_youtube_metadata("https://youtu.be/fbm_O3pD_3c", client=mock_client)
    assert resolved.youtubeId == "fbm_O3pD_3c"
    assert resolved.thumbnailUrl == "https://i.ytimg.com/vi/fbm_O3pD_3c/hqdefault.jpg"
    assert resolved.title == "ISKCON Srimad-Bhagavatam Class"
    assert resolved.speaker == "Vaishnava Speaker"
```

- [ ] **Step 2: Run `pytest` to verify the new tests fail**

Run: `backend/.venv/bin/pytest backend/tests/test_api.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 3: Implement `backend/app/youtube_resolver.py` and `backend/app/main.py`**

Implement:
- `extract_youtube_id(raw_input: str) -> str | None` matching watch URLs, `youtu.be/`, `/shorts/`, `/embed/`, `/live/`, or exact 11-character `[a-zA-Z0-9_-]{11}` IDs.
- `resolve_youtube_metadata(raw_input: str, client: httpx.Client | None = None) -> YouTubeResolveResponse` raising `ValueError("Invalid YouTube URL or video ID")` when `extract_youtube_id` returns `None`, querying `https://noembed.com/embed?url=https://www.youtube.com/watch?v={video_id}` with a 3.0s timeout, and falling back to `title="ISKCON Srimad-Bhagavatam Class"`, `speaker="Vaishnava Speaker"` on any `httpx.HTTPError` or missing fields.
- `backend/app/main.py` with `CORSMiddleware` (allowing `http://localhost:5173` and `http://127.0.0.1:5173`), `Query(ge=2020, le=2035)` on `year`, `Query(ge=1, le=12)` on `month`, `HTTPException(status_code=422)` when `parse_vaishnava_ics` returns an empty list, and `HTTPException(status_code=422)` when `resolve_youtube_metadata` raises `ValueError`.

- [ ] **Step 4: Run the full backend test suite**

Run: `backend/.venv/bin/pytest backend/tests -v`
Expected: `9 passed`

- [ ] **Step 5: Commit Task 2**

```bash
git add backend/app/models.py backend/app/youtube_resolver.py backend/app/main.py backend/tests/test_api.py
git commit -m "feat(backend): add YouTube resolver and FastAPI routes"
```

---

### Task 3: Firebase Config, Security Rules, Deterministic Merge & Client API Layer

**Files:**
- Create: `firestore.rules`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/firebase/config.ts`
- Create: `src/firebase/sadhanaSync.ts`
- Create: `src/api/backendClient.ts`
- Test: `src/test/sadhanaSync.test.ts`

**Interfaces:**
- Consumes: `DailySadhanaRecord`, `VaishnavaEvent`, `IskconCity` from `src/sadhanaData.ts`
- Produces:
  - `src/firebase/config.ts`:
    - `isFirebaseConfigured(): boolean`
    - `getFirebaseClients(): { app: FirebaseApp; auth: Auth; db: Firestore; googleProvider: GoogleAuthProvider } | null`
  - `src/firebase/sadhanaSync.ts`:
    - `TimestampedSadhanaRecord = DailySadhanaRecord & { updatedAt?: string }`
    - `mergeDailyRecords(local: TimestampedSadhanaRecord, remote: TimestampedSadhanaRecord): TimestampedSadhanaRecord`
    - `mergeRecordLists(localList: TimestampedSadhanaRecord[], remoteList: TimestampedSadhanaRecord[]): TimestampedSadhanaRecord[]`
    - `saveDayRecordToFirestore(uid: string, record: DailySadhanaRecord): Promise<void>`
    - `saveUserPrefsToFirestore(uid: string, prefs: { theme: 'light' | 'dark'; selectedCityId: string; customCalendarEvents?: VaishnavaEvent[] }): Promise<void>`
    - `subscribeToUserSadhana(uid: string, localSeed: DailySadhanaRecord[], onRecords: (records: DailySadhanaRecord[]) => void, onPrefs?: (prefs: { theme?: 'light' | 'dark'; selectedCityId?: string; customCalendarEvents?: VaishnavaEvent[] }) => void): () => void`
  - `src/api/backendClient.ts`:
    - `fetchCalendarMonth(year: number, month: number, cityId: string): Promise<VaishnavaEvent[]>`
    - `importCalendarIcsViaApi(icsText: string, cityId: string): Promise<VaishnavaEvent[]>`
    - `resolveYouTubeViaApi(urlOrId: string): Promise<{ youtubeId: string; title: string; speaker: string; thumbnailUrl: string } | null>`

- [ ] **Step 1: Install `firebase` and `vitest` and configure Vite proxy `/api` -> `http://127.0.0.1:8000`**

Run: `npm install firebase && npm install -D vitest`
Update `package.json` scripts to include `"test": "vitest run"` and `"dev:backend": "backend/.venv/bin/uvicorn app.main:app --app-dir backend --reload --port 8000"`.
Update `vite.config.ts` to add:
```ts
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
    },
  },
},
```

- [ ] **Step 2: Write the failing Vitest unit tests in `src/test/sadhanaSync.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { mergeDailyRecords, mergeRecordLists } from '../firebase/sadhanaSync';
import { fetchCalendarMonth, resolveYouTubeViaApi } from '../api/backendClient';
import { INITIAL_SADHANA_HISTORY } from '../sadhanaData';

describe('mergeDailyRecords', () => {
  it('test_merge_daily_records_preserves_non_empty_reflection_and_unions_items', () => {
    const base = INITIAL_SADHANA_HISTORY[0];
    const phoneRecord = {
      ...base,
      completedRounds: 16,
      chantedBefore7AM: true,
      reflection: '',
      updatedAt: '2026-11-02T09:00:00.000Z',
    };
    const laptopRecord = {
      ...base,
      completedRounds: 12,
      chantedBefore7AM: false,
      reflection: 'Deep absorption during morning Japa.',
      readings: [
        ...base.readings,
        {
          id: 'rd-new',
          book: 'Sri Isopanisad',
          reference: 'Mantra 1',
          pages: 3,
          minutes: 10,
          note: 'Isavasyam idam sarvam.',
        },
      ],
      updatedAt: '2026-11-02T07:00:00.000Z',
    };

    const merged = mergeDailyRecords(phoneRecord, laptopRecord);
    expect(merged.completedRounds).toBe(16);
    expect(merged.chantedBefore7AM).toBe(true);
    expect(merged.reflection).toBe('Deep absorption during morning Japa.');
    expect(merged.readings.some((r) => r.id === 'rd-new')).toBe(true);
    expect(merged.readings.length).toBe(base.readings.length + 1);
  });

  it('merges record lists sorted descending by date', () => {
    const listA = [{ ...INITIAL_SADHANA_HISTORY[1], completedRounds: 10 }];
    const listB = [
      { ...INITIAL_SADHANA_HISTORY[0], completedRounds: 14 },
      { ...INITIAL_SADHANA_HISTORY[1], completedRounds: 16 },
    ];
    const merged = mergeRecordLists(listA, listB);
    expect(merged[0].date).toBe('2026-11-02');
    expect(merged[1].date).toBe('2026-11-01');
    expect(merged[1].completedRounds).toBe(16);
  });
});

describe('backendClient offline fallbacks', () => {
  it('falls back to built-in calendar when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));
    const events = await fetchCalendarMonth(2026, 11, 'nyc');
    expect(events.length).toBe(30);
    expect(events[0].date).toBe('2026-11-01');
    vi.unstubAllGlobals();
  });

  it('falls back to local YouTube ID extraction when API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));
    const res = await resolveYouTubeViaApi('https://youtu.be/fbm_O3pD_3c');
    expect(res?.youtubeId).toBe('fbm_O3pD_3c');
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 3: Run `npx vitest run` to verify the tests fail**

Run: `npx vitest run src/test/sadhanaSync.test.ts`
Expected: FAIL with `Cannot find module '../firebase/sadhanaSync'`

- [ ] **Step 4: Create `firestore.rules`, `.env.example`, `src/firebase/config.ts`, `src/firebase/sadhanaSync.ts`, and `src/api/backendClient.ts`**

Implement:
- `firestore.rules` matching Spec §4.3 (`allow read, write: if request.auth != null && request.auth.uid == uid;`).
- `.env.example` listing `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
- `src/firebase/config.ts` using `initializeApp`, `getAuth`, `GoogleAuthProvider`, and `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })` when `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID` are non-empty.
- `src/firebase/sadhanaSync.ts` implementing `mergeDailyRecords`, `mergeRecordLists`, and Firestore read/write/listener helpers.
- `src/api/backendClient.ts` calling `/api/calendar`, `/api/calendar/import-ics`, and `/api/youtube/resolve` with try/catch fallback to `DEFAULT_VAISHNAVA_CALENDAR_NOV_2026`, `parseVaishnavaIcs`, and `extractYouTubeId`.

- [ ] **Step 5: Run `npx vitest run` to verify all unit tests pass**

Run: `npx vitest run src/test/sadhanaSync.test.ts`
Expected: `4 passed`

- [ ] **Step 6: Commit Task 3**

```bash
git add firestore.rules .env.example package.json package-lock.json vite.config.ts src/firebase/config.ts src/firebase/sadhanaSync.ts src/api/backendClient.ts src/test/sadhanaSync.test.ts
git commit -m "feat(sync): add Firebase offline Firestore sync, merge rules, and FastAPI client"
```

---

### Task 4: Google Login Screen & Workspace Integration

**Files:**
- Create: `src/components/LoginScreen.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.tsx`
- Test: `src/test/loginScreen.test.ts`

**Interfaces:**
- Consumes: `src/firebase/config.ts`, `src/firebase/sadhanaSync.ts`, `src/api/backendClient.ts`
- Produces:
  - `src/components/LoginScreen.tsx`:
    - `LoginScreenProps`: `{ firebaseConfigured: boolean; onGoogleSignIn: () => Promise<void>; onContinueLocal: () => void; authError: string | null; isSigningIn: boolean; theme: 'light' | 'dark'; onToggleTheme: () => void }`
    - `LoginScreen(props: LoginScreenProps): JSX.Element`
  - `src/App.tsx`:
    - Displays `LoginScreen` until the user signs in with Google (via Firebase Auth `onAuthStateChanged` / `signInWithPopup`) or selects `Continue in Local Offline Mode` (persisted in `sessionStorage` / `localStorage` key `sadhana_valli_session_mode_v1`).
    - Syncs `records`, `theme`, `selectedCityId`, and `calendarEvents` with Firestore when a Firebase `User` is active.
    - Uses `fetchCalendarMonth`, `importCalendarIcsViaApi`, and `resolveYouTubeViaApi` in `src/App.tsx`.

- [ ] **Step 1: Write the failing auth state helper test in `src/test/loginScreen.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { resolveInitialSessionGate } from '../components/LoginScreen';

describe('resolveInitialSessionGate', () => {
  it('requires login screen when no Firebase user and no local mode opt-in', () => {
    expect(resolveInitialSessionGate(null, null)).toBe('login');
  });

  it('enters workspace when Firebase user is present', () => {
    expect(resolveInitialSessionGate({ uid: 'u1', email: 'harshal@example.com' }, null)).toBe('authenticated');
  });

  it('enters workspace in local mode when user chose local offline mode', () => {
    expect(resolveInitialSessionGate(null, 'local')).toBe('local');
  });
});
```

- [ ] **Step 2: Run `npx vitest run` to verify the test fails**

Run: `npx vitest run src/test/loginScreen.test.ts`
Expected: FAIL with `Cannot find module '../components/LoginScreen'`

- [ ] **Step 3: Implement `src/components/LoginScreen.tsx`, scoped login styles in `src/styles.css`, and wire `src/App.tsx`**

Implement:
- `resolveInitialSessionGate(user: { uid: string; email?: string | null } | null, storedMode: string | null): 'login' | 'authenticated' | 'local'` in `src/components/LoginScreen.tsx`.
- `LoginScreen` component using Sadhana Valli's existing typography (`Instrument Serif` heading, `General Sans` body), surface tokens (`--chrome-bg`, `--sheet-bg`, `--surface`, `--border`, `--accent`), a primary `Continue with Google` button, a secondary `Continue in Local Offline Mode` button, and a non-blocking `.env` setup note if `!firebaseConfigured`.
- Update `src/App.tsx` to:
  1. Subscribe to `onAuthStateChanged` when Firebase is configured.
  2. Render `<LoginScreen />` when `sessionGate === 'login'`.
  3. Subscribe to `subscribeToUserSadhana(user.uid, ...)` and write updates through `saveDayRecordToFirestore` / `saveUserPrefsToFirestore` when signed in.
  4. Call `fetchCalendarMonth`, `importCalendarIcsViaApi`, and `resolveYouTubeViaApi` so the frontend uses the Python FastAPI backend seamlessly.
  5. Provide a `Sign out / Switch Account` button in the Cloud Sync panel and topbar pill.

- [ ] **Step 4: Run all frontend & backend tests and production build**

Run: `npx vitest run && npm run build && backend/.venv/bin/pytest backend/tests -v`
Expected: All Vitest tests PASS, `tsc -b && vite build` succeeds with exit code `0`, and all `pytest` tests PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/components/LoginScreen.tsx src/styles.css src/App.tsx src/test/loginScreen.test.ts
git commit -m "feat(auth): add Google login gate and connect workspace to Firestore and FastAPI"
```
