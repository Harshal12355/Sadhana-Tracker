# Sadhana Valli — Firebase Auth, Firestore Offline Sync & Python FastAPI Backend Design

## 1. Intent & Why

Sadhana Valli is an ADHD-friendly daily ISKCON Sadhana workspace used across phone (`390px`), tablet (`768px`), and laptop (`1440px`) in Light and Dark mode. Today, all state in `src/App.tsx` is trapped in browser `localStorage`, the Google sign-in button only toggles a local string, and the Vaishnava calendar is hardcoded to November 2026 in `src/sadhanaData.ts`.

We are adding:
1. **A real Google Login page and Auth session** backed by Firebase Authentication.
2. **Offline-first Cloud Firestore persistence** per practitioner (`users/{uid}`) so morning Japa rounds respond in 0ms offline and sync automatically across devices when online.
3. **A Python FastAPI backend (`backend/`)** connected via Vite proxy (`/api/*`) to serve Vaishnava calendar & Parana calculations across months/cities, `.ics` calendar parsing, and server-side YouTube lecture metadata resolution.

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Google Sign-In Gate**: Present a calm, on-brand login screen (`Continue with Google`) when unauthenticated, while providing a one-click `Continue in Local Mode` fallback when Firebase environment variables (`VITE_FIREBASE_API_KEY`) are not yet configured.
- **Per-User Firestore Vault with Offline Cache**: Store user preferences at `users/{uid}` and daily Sadhana logs at `users/{uid}/days/{YYYY-MM-DD}` with Firestore `persistentLocalCache` enabled.
- **First-Login LocalStorage Migration & Deterministic Merge**: When a user signs in with Google, merge any existing `localStorage` records into Firestore without losing rounds, readings, or lectures.
- **Python FastAPI Service (`backend/`)**:
  - `GET /api/health` — health check.
  - `GET /api/cities` — supported ISKCON temple locations and Parana offsets.
  - `GET /api/calendar?year=YYYY&month=MM&city_id=nyc` — returns every day of the requested month with Vaishnava `tithi`, `paksha`, `masa`, `festival`, `type`, `fastingNote`, `paranaBaseWindow`, and city-adjusted `paranaWindow`, plus `nextEkadashi`.
  - `POST /api/calendar/import-ics` — parses uploaded `.ics` content into normalized `VaishnavaEvent` objects.
  - `GET /api/youtube/resolve?url=...` — extracts the 11-character YouTube video ID and resolves `title`, `speaker`, and `thumbnailUrl` server-side.
- **Zero-Breakage Offline Fallback**: If the FastAPI server or network is unreachable, the React frontend falls back cleanly to local calculations in `src/sadhanaData.ts`.

### Non-Goals
- Multi-user sharing, public leaderboards, or counselor/mentor dashboards.
- Routing `+1 Japa Round` taps through Python FastAPI (Firestore handles user logs directly for 0ms offline response).
- Server-side storage of user Sadhana logs outside Firebase Firestore.

### Anti-Goals
- Blocking 4:45 AM Japa chanting on a network spinner.
- Asking the user to paste raw database URLs or API keys into the UI.

## 3. Architecture & Approaches Considered

### Approaches Evaluated
1. **Chosen — Hybrid Architecture: Firebase Client SDK (Auth + Offline Firestore) + Python FastAPI for Calendar/YouTube APIs**
   - *How it works*: React authenticates with Google via Firebase Auth and reads/writes user logs directly to Cloud Firestore (with IndexedDB offline persistence). React calls Python FastAPI (`/api/*`) for Vaishnava calendar generation, Parana window calculation, `.ics` parsing, and YouTube metadata resolution.
   - *Trade-off*: Best of both worlds — 0ms offline Sadhana logging via Firestore's native sync engine, plus Python's clean date/calendar and HTTP ecosystem for almanac and media endpoints.
2. **All-Firebase (No Python Backend)**
   - *Trade-off*: Simpler deployment, but keeps all Vaishnava calendar calculations and third-party oEmbed scraping inside client-side TypeScript.
3. **All-Python Proxy (React → FastAPI → Firebase Admin SDK)**
   - *Trade-off*: Centralizes everything in Python, but loses Firestore's automatic IndexedDB offline cache and real-time multi-tab listener unless re-implemented manually.

### System Diagram

```text
┌──────────────────────────────────────────────────────────────────────┐
│ React Frontend (Vite · :5173)                                        │
│  ├─ LoginScreen.tsx ("Continue with Google" + Local Mode fallback)   │
│  ├─ AuthContext.tsx (Firebase User | Local Guest)                    │
│  └─ App.tsx (Sadhana Valli Workspace)                                │
└───────────────┬──────────────────────────────────────┬───────────────┘
                │                                      │
   Firestore SDK (IndexedDB Offline Cache)     HTTP /api/* (Vite Proxy)
                │                                      │
                ▼                                      ▼
┌───────────────────────────────┐      ┌───────────────────────────────┐
│ Firebase (Google Cloud)       │      │ Python FastAPI (backend/ :8000)│
│  ├─ Firebase Auth (Google)    │      │  ├─ GET  /api/health          │
│  ├─ users/{uid} (prefs/meta)  │      │  ├─ GET  /api/cities          │
│  └─ users/{uid}/days/{date}   │      │  ├─ GET  /api/calendar        │
│     (DailySadhanaRecord)      │      │  ├─ POST /api/calendar/ics    │
└───────────────────────────────┘      │  └─ GET  /api/youtube/resolve │
                                       └───────────────────────────────┘
```

## 4. Detailed Component Design

### 4.1 Repository Structure

```text
/Users/harshal/Front end trial/
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, CORS, routes
│   │   ├── models.py            # Pydantic request/response schemas
│   │   ├── calendar_engine.py   # Vaishnava calendar & Parana calculations + .ics parser
│   │   └── youtube_resolver.py  # YouTube ID extractor & oEmbed metadata fetcher
│   └── tests/
│       ├── test_calendar.py
│       └── test_youtube.py
├── src/
│   ├── firebase/
│   │   ├── config.ts            # Firebase app, Auth, and persistent Firestore init
│   │   └── sadhanaSync.ts       # Merge logic, Firestore listeners, and write helpers
│   ├── components/
│   │   └── LoginScreen.tsx      # Google Sign-In screen matching Sadhana Valli design system
│   ├── App.tsx                  # Workspace wired to Auth + Firestore + FastAPI
│   ├── sadhanaData.ts           # Shared TypeScript interfaces & local fallback data
│   └── test/
│       └── sadhanaSync.test.ts  # Vitest unit tests for merge & client API helpers
├── firestore.rules              # Strict per-uid Firestore security rules
├── .env.example                 # Template for VITE_FIREBASE_* variables
└── vite.config.ts               # Adds /api proxy -> http://127.0.0.1:8000 and Vitest config
```

### 4.2 Data Model & Merge Rules (Firestore)

1. **User Document (`users/{uid}`)**:
   ```ts
   interface UserPreferencesDoc {
     uid: string;
     email: string | null;
     displayName: string | null;
     photoURL: string | null;
     theme: 'light' | 'dark';
     selectedCityId: string;
     customCalendarEvents?: VaishnavaEvent[];
     updatedAt: string; // ISO-8601
   }
   ```
2. **Daily Log Document (`users/{uid}/days/{date}`)** where `{date}` is `YYYY-MM-DD`:
   Matches `DailySadhanaRecord` (`date`, `tithi`, `panchangaNote`, `targetRounds`, `completedRounds`, `chantedBefore7AM`, `readings`, `lectures`, `reflection`, `wakeTime`, `mangalaArati`, plus `updatedAt: string`).
3. **Deterministic Day-Record Merge (`mergeDailyRecords(local, remote)`)**:
   - `completedRounds`: `Math.max(local.completedRounds, remote.completedRounds)`
   - `chantedBefore7AM`: `local.chantedBefore7AM || remote.chantedBefore7AM`
   - `mangalaArati`: `local.mangalaArati || remote.mangalaArati`
   - `readings`: deduplicated union by `id` (preserving newest first)
   - `lectures`: deduplicated union by `id` (preserving newest first)
   - `reflection`: if one is empty, keep the non-empty string; if both are non-empty and identical, keep it; if both differ, keep the one from the newer `updatedAt` record.
   - `wakeTime`: keep from the newer `updatedAt` record (defaulting to `'05:00'`).

### 4.3 Firestore Security Rules (`firestore.rules`)

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /days/{date} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

### 4.4 Python FastAPI Specification (`backend/`)

1. **`GET /api/health`**
   - Response `200 OK`: `{"status": "ok", "service": "sadhana-valli-api"}`
2. **`GET /api/cities`**
   - Response `200 OK`: `{"cities": [{"id": "nyc", "name": "New York (Brooklyn)", "country": "USA (EST)", "paranaShiftMinutes": 0}, ...]}`
3. **`GET /api/calendar?year=2026&month=11&city_id=nyc`**
   - Validates `1 <= month <= 12`, `2020 <= year <= 2035`. Unknown `city_id` defaults to `"nyc"`.
   - For November 2026, returns the canonical Gaurabda 540 Damodara/Kesava dataset with `paranaWindow` computed for `city_id`.
   - For any other month/year, algorithmically computes the lunar synodic Tithi cycle (`Krsna`/`Gaura` Paksha, 15 Tithis per Paksha, Vaishnava Masa, Ekadashi on the 11th Tithi of each Paksha, and Dvadashi Parana window on the following day shifted by `city.paranaShiftMinutes`).
   - Response `200 OK`:
     ```json
     {
       "year": 2026,
       "month": 11,
       "city": { "id": "nyc", "name": "New York (Brooklyn)", "country": "USA (EST)", "paranaShiftMinutes": 0 },
       "events": [ ... ],
       "nextEkadashi": { ... }
     }
     ```
4. **`POST /api/calendar/import-ics`**
   - Request body: `{"icsText": "BEGIN:VCALENDAR...", "cityId": "nyc"}`
   - Parses `BEGIN:VEVENT` blocks, extracts `DTSTART`, `SUMMARY`, `DESCRIPTION`, classifies `ekadashi` / `parana` / `festival`, and computes `paranaWindow`.
   - Response `200 OK`: `{"importedCount": N, "events": [...]}` (returns `422` if `icsText` is empty or contains no valid `VEVENT` blocks).
5. **`GET /api/youtube/resolve?url=...`**
   - Extracts the 11-character YouTube ID from watch URLs, `youtu.be/`, `/shorts/`, `/embed/`, or raw 11-char IDs. Invalid input returns `422`.
   - Queries `https://noembed.com/embed?url=https://www.youtube.com/watch?v={id}` with a 3.0s timeout; falls back to default speaker/title if offline.
   - Response `200 OK`:
     ```json
     {
       "youtubeId": "fbm_O3pD_3c",
       "youtubeUrl": "https://www.youtube.com/watch?v=fbm_O3pD_3c",
       "title": "...",
       "speaker": "...",
       "thumbnailUrl": "https://i.ytimg.com/vi/fbm_O3pD_3c/hqdefault.jpg"
     }
     ```

### 4.5 Login Page & Topbar UX (`src/components/LoginScreen.tsx`)

- Matches the existing `DESIGN.md` tokens (`--chrome-bg`, `--sheet-bg`, `--surface`, `--text`, `--accent`, Instrument Serif heading, General Sans UI copy) in both Light and Dark mode.
- Displays:
  1. Primary CTA: **Continue with Google** (launches Firebase Google OAuth popup; if Firebase config env vars are missing, displays a clear inline setup banner with instructions for `.env`).
  2. Secondary CTA: **Continue in Local Offline Mode** (lets the user enter the workspace immediately using `localStorage`, preserving zero-friction access during local development).
- Inside the workspace topbar, shows the signed-in Google email/avatar (or `Local Mode`) and a `Sign out` action in the Cloud Sync panel.

## 5. Constraints & Builder Calls

- **Python runtime**: Python 3.11+ managed in `backend/.venv` with `fastapi`, `uvicorn`, `httpx`, `pydantic`, and `pytest`.
- **Frontend packages**: `firebase` (v11+) for Auth & Firestore, `vitest` for unit testing sync/merge and API utilities.
- **Design preservation**: Do not alter the existing 12-column layout, color tokens, or typography rules in `DESIGN.md` and `src/styles.css`; only add scoped styles for `LoginScreen` and the auth status controls.
