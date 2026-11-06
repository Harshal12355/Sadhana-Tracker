# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React + TypeScript + Local-First Storage with One-Click Google / GitHub Sign-In Cloud Sync (Supabase / Firebase OAuth) and Built-In ISKCON Vaishnava Calendar + `.ics` Importer.

## Users

Harshal (and fellow ISKCON practitioners) logging daily devotional Sadhana across phone (`390px`), tablet (`768px`), and laptop (`1440px`) in both **Light Mode** and **Dark Mode**. The user has ADHD and needs an ultra-simple, low-friction daily workspace without complex matrices or manual API-key configuration.

## Product Purpose

Provide a calm, ADHD-friendly daily Sadhana workspace (**Sadhana Valli**) with a simple Japa round stepper, Shastra reading log, YouTube Sravanam lecture shelf, daily reflection journal, a real **ISKCON Vaishnava Calendar** (with city/timezone Parana windows + `.ics` import from `vaishnavacalendar.org`), and one-click Google/GitHub cloud sync.

## Positioning

Purpose-built for ISKCON daily practice with zero complexity:
- **Simple Japa Round Stepper:** Clean progress bar (`0` to `16+` rounds) with `-1`, `+1 Round (Space)`, `+4`, and `16 Done` buttons plus one optional *"Chanted before 7:00 AM"* toggle (no complex 16-box time-band or Granthi matrices).
- **ISKCON Vaishnava Calendar Engine:** Monthly & upcoming festival grid calculating Ekadashis, Parana fast-break times by city, and Appearance/Disappearance days, overlaid with your daily Sadhana completion dots and `.ics` file import.
- **One-Click Google / GitHub Cloud Sync:** Sign in with Google or GitHub to sync logs across phone, tablet, and laptop without pasting REST URLs or API keys.

## Capabilities and Constraints

- **Light & Dark Mode Toggle:** Instant one-click switch in the top bar (persisted in `localStorage` and respecting `prefers-color-scheme`) using true neutral darks (`#0c0d0c` chrome, `#141615` sheet, `#1b1e1c` surface, `#222624` raised card, `#2a2e2c` border, `#2e9b8f` luminous teal data accent).
- **Pillar 1 — Simple Japa Counter:** Large tabular counter (`12 / 16 rounds`), smooth progress bar, `-1`, `+1 Round`, `+4`, `16 Done`, and a single *"Chanted before 7:00 AM"* toggle.
- **Pillar 2 — Shastra Reading (in-app reader + log):** "Read one verse" opens a focus-mode reader over Vedabase (text stays on Vedabase under BBT copyright; the app ships only verse numbers in `src/reader/index`, rebuilt with `scripts/build_vedabase_index.py`). One-verse goal, auto timer that counts only while the tab is visible, a recall step that hides the verse and asks for one sentence from memory, next-verse stepping that handles combined verses (Bg 1.16-18), per-book resume point, last session's recall as a warm-up, and an automatic log entry (verses, minutes, recall notes). Manual logging by pages still available.
- **Pillar 3 — Sravanam (YouTube Lecture Log):** Paste any YouTube URL to auto-resolve title, speaker, poster/thumbnail preview, inline video player, and realization note.
- **Pillar 4 — Vaishnava Calendar & Daily Reflection:** Interactive monthly calendar grid showing Masa, Paksha, Tithi, Ekadashi fast days, Parana windows for the selected city, `.ics` import from `vaishnavacalendar.org`, and clicking any calendar day loads that day's Sadhana log and reflection.

## Evidence on Hand

- Built-in Gaurabda 540 (2026–2027) Vaishnava Calendar dataset with verified Ekadashis, Parana windows across major ISKCON temple cities, and major Appearance/Disappearance festivals, plus client-side `.ics` parser.
- Reconciled 14-day Sadhana metrics (`console.assert` verified).

## Product Principles

1. **Keep It Simple (ADHD-First):** One-tap Japa stepper and progress bar instead of complex 16-cell matrices.
2. **First-Class Dark Mode:** Calm early-morning dark mode (`#0c0d0c` / `#141615` / `#1b1e1c`) for chanting before dawn without eye strain.
3. **Vaishnava Calendar as the Spine:** Navigate your Sadhana directly on the Vaishnava lunar/solar calendar with Ekadashi and Parana reminders built in.
4. **Zero-Config Cloud Sync:** One-click Google or GitHub sign-in instead of raw database URLs and API keys.
