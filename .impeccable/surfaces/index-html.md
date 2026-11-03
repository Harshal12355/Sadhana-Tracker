---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Surface Brief — Sadhana Valli (`index.html` / `src/App.tsx`)

## Scope and Visitor Mode

- **Target:** `index.html` (and `src/App.tsx` / `src/styles.css`)
- **Mode:** Operate (`editorial-greeting` app style, Light + Dark Mode)
- **Build Path:** Code-led

## Audience, Job, Action & Proof

- **Audience:** Harshal logging daily ISKCON Sadhana across phone (`390px`), tablet (`768px`), and laptop (`1440px`) in Light or Dark mode.
- **One Question:** *"How many of today's 16 Japa rounds, reading minutes, and lecture notes are logged, and when is the next Ekadashi or festival on the Vaishnava Calendar?"*
- **Primary Action:** One-click `+1 Japa Round (Space)` (or `-1`, `+4 Rounds`, `16 Done` on the simplified Japa stepper) and clicking any day on the **ISKCON Vaishnava Calendar** to inspect/log Sadhana or view Ekadashi Parana times.
- **Proof & Signature Elements:**
  1. **Light / Dark Mode Theme Switcher:** True neutral darks (`#0c0d0c` chrome, `#141615` sheet, `#1b1e1c` surface, `#222624` raised card, `#2a2e2c` border) and warm sandalwood light mode (`#f3efe6` / `#fbf9f5`).
  2. **Simplified Japa Counter & Progress Track:** Replaces the 16-cell Granthi matrix with a clean regular-weight readout (`12 of 16 rounds`), a single horizontal progress bar, `-1` / `+1 Round` / `+4 Rounds` / `16 Done` buttons, and a single *"Chanted before 07:00 AM"* toggle.
  3. **Interactive ISKCON Vaishnava Calendar (Built-in Engine + `.ics` Import):** Replaces the 14-day table with a full Vaishnava Calendar showing Tithi, Masa, Ekadashi fast badges, city-adjusted Parana fast-break windows (New York, Los Angeles, London, Sri Mayapur, Mumbai, Toronto), Sadhana completion dots on every date, and `.ics` file import.
  4. **One-Click Google / GitHub Cloud Sync:** Replaces raw URL/API-key inputs with one-click Google and GitHub account sync + automatic background backup.

## Direction contract

THESIS: A calm, dual-theme (Sandalwood Light & Brahma-Muhurta Dark) ISKCON Sadhana Workspace where a simplified Japa round stepper, Shastra reading log, YouTube Sravanam card, and an interactive Vaishnava Calendar replace cluttered matrices and manual spreadsheets.
OWN-WORLD: Dual-mode tokens (`--chrome-bg: #f3efe6`, `--sheet-bg: #fbf9f5`, `--accent: #1b6e66` in Light; `--chrome-bg: #0c0d0c`, `--sheet-bg: #141615`, `--surface: #1b1e1c`, `--raised: #222624`, `--accent: #2e9b8f` in Dark), `Instrument Serif` (`h1` greeting) paired with `Instrument Sans` (`tabular-nums`), and zero drop shadows at rest.
STORY: The practitioner opens Sadhana Valli in Light or Dark mode, taps `+1 Japa Round` on the simple progress stepper, logs Shastra reading and YouTube lectures, checks the Vaishnava Calendar for Ekadashi and Parana times in their city, and syncs across devices with one-click Google or GitHub sign-in.
FIRST VIEWPORT: Left `224px` sidebar and `48px` top bar (with Date selector, Ekadashi pill, One-Click Cloud Sync status, and **Light / Dark Mode** toggle) framing the inset workspace sheet: Row 1 has the `Instrument Serif` greeting and `+1 Japa Round` action; Row 2 holds 4 KPI tiles; Row 3 (`8+4` split) pairs the **Simplified Japa Counter + Shastra Reading Log** with the **Sravanam YouTube Card**; Row 4 holds the full-width **Interactive ISKCON Vaishnava Calendar** (with `.ics` import); Row 5 (`6+6` split) pairs the **Daily Reflection Journal** with **One-Click Cloud Sync & 14-Day Chart**.
FORM: Panchanga Tithi Almanac (candidate #5 on the ordered grounded list, `seed:e12bc7aef742f878`).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
