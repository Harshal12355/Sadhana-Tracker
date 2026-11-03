---
name: Sadhana Valli
description: Dual-mode (Sandalwood Light & Brahma-Muhurta Dark) ISKCON daily Sadhana workspace and Vaishnava calendar
colors:
  accent: "#1b6e66"
  accent-hover: "#155750"
  accent-soft: "#d7ebe8"
  accent-soft-ink: "#123e39"
  poster-bg: "#163d38"
  positive: "#246a28"
  warning: "#8c420e"
  negative: "#a12016"
  pill-positive-bg: "#dcfae5"
  pill-positive-ink: "#04250e"
  pill-warning-bg: "#fff3e0"
  pill-warning-ink: "#7c3808"
  pill-neutral-bg: "#e5dfd2"
  pill-neutral-ink: "#363532"
  chrome-bg: "#f3efe6"
  sheet-bg: "#fbf9f5"
  surface: "#f3efe6"
  raised: "#ffffff"
  nav-active: "#e5dfd2"
  nav-hover: "#ebe5d8"
  border: "#e2ddd2"
  rule: "#ebe6dc"
  control: "#cfc9bc"
  text: "#1c201e"
  muted: "#575652"
  dark-chrome-bg: "#0c0d0c"
  dark-sheet-bg: "#141615"
  dark-surface: "#1b1e1c"
  dark-raised: "#222624"
  dark-nav-active: "#232725"
  dark-border: "#2a2e2c"
  dark-control: "#3a3f3c"
  dark-text: "#f3f2ee"
  dark-muted: "#b0aea8"
  dark-accent: "#2e9b8f"
  dark-accent-hover: "#3ab3a6"
  dark-accent-soft: "#173330"
  dark-accent-soft-ink: "#7ee2d6"
typography:
  display:
    fontFamily: "'General Sans', 'Satoshi', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.14
    letterSpacing: "-0.028em"
  japa-counter:
    fontFamily: "'General Sans', 'Satoshi', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 400
    lineHeight: 1
  headline:
    fontFamily: "'General Sans', 'Satoshi', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.05
  brand:
    fontFamily: "'General Sans', 'Satoshi', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.15
  title:
    fontFamily: "'General Sans', 'Satoshi', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "'General Sans', 'Satoshi', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  compact:
    fontFamily: "'General Sans', 'Satoshi', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.35
  label:
    fontFamily: "'General Sans', 'Satoshi', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
  micro:
    fontFamily: "'General Sans', 'Satoshi', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  xs: "2px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  row: "12px"
  inner: "14px"
  sheet: "16px"
  mobile-card: "18px"
  card: "22px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "28px"
  xxl: "36px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.raised}"
    rounded: "{rounded.pill}"
    height: "38px"
    padding: "0 18px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    height: "38px"
    padding: "0 14px"
  card-kpi:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    height: "128px"
    padding: "16px 20px"
  card-japa-stepper:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.inner}"
    padding: "20px"
  card-calendar-cell:
    backgroundColor: "{colors.sheet-bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
  button-oauth:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 14px"
---

# Design System: Sadhana Valli

## Overview

**Creative North Star: "The Sandalwood & Brahma-Muhurta Panchanga Almanac"**

Sadhana Valli is an ADHD-friendly daily devotional workspace modeled after a Vaishnava Panchanga almanac resting inside a sandalwood desk tray by day and a quiet pre-dawn Brahma-muhurta study by night. Rather than overwhelming the practitioner with a 16-box time-band matrix, Granthi sub-grids, or manual API-key forms, the interface pairs a single 4-button Japa progress stepper (`-1`, `+1 Round`, `+4 Rounds`, `16 Done`) with a Shastra reading log, a live Sravanam YouTube lecture shelf, an interactive 30-day ISKCON Vaishnava Calendar, and one-click Google/GitHub cloud sync.

Visual hierarchy relies on flat tonal paper nesting, generous radius stepping, and typographic contrast across both Light Mode (`#f3efe6` / `#fbf9f5` / `#ffffff`) and Dark Mode (`#0c0d0c` / `#141615` / `#1b1e1c` / `#222624`). `Instrument Serif` speaks once per screen in the `h1` devotional greeting, while `Instrument Sans` with `tabular-nums` governs every counter, Parana window, calendar cell, and lecture card.

**Key Characteristics:**
- **Dual-Mode Tonal L-Frame Shell:** A `224px` left navigation rail and `48px` top bar cradle an inset workspace sheet (`16px` radius) with one-click switching between Sandalwood Light Mode and true-neutral Brahma-Muhurta Dark Mode (`prefers-color-scheme` aware).
- **Ultra-Simple Japa Stepper:** A single raised card with a `36px` regular-weight counter, a `12px` pill progress bar, `-1` / `+1 Round` / `+4 Rounds` / `16 Done` buttons, and a themed `Chanted before 07:00 AM` checkbox.
- **Interactive ISKCON Vaishnava Calendar Engine:** A 6-column monthly grid (3-column on phones) displaying Tithi, Paksha, Masa, marigold Ekadashi fast cards, city-adjusted Parana fast-break windows across 6 ISKCON temple hubs, Sadhana completion badges (`16r`, `12r`), and `.ics` calendar import.
- **Zero-Config One-Click OAuth Sync:** Google and GitHub sign-in buttons that sync logs automatically without exposing database URLs or API keys.

## Colors

The palette pairs warm sandalwood and parchment paper neutrals in Light Mode with true neutral obsidian-greens in Dark Mode, anchored by Peacock Teal for chanting progress and Marigold Ochre for Ekadashi/Parana notices.

### Primary
- **Peacock Teal** (`#1b6e66` light / `#2e9b8f` dark): Primary `+1 Japa Round` action, progress bar fill, active calendar day border, native checkbox `accent-color`, and 14-day continuity bars.
- **Peacock Hover** (`#155750` light / `#3ab3a6` dark): Hover state for primary action pills.
- **Morning Mist Teal** (`#d7ebe8` light / `#173330` dark): Soft tint fill for connected OAuth buttons (`#123e39` light ink / `#7ee2d6` dark ink).
- **Sravanam Archive Forest** (`#163d38`): Deep geometric poster ground behind YouTube lecture thumbnails.

### Secondary
- **Marigold Ochre** (`#8c420e` light / `#f0b45b` dark): Border and highlight accent for Ekadashi fast cells on the Vaishnava Calendar.
- **Marigold Tithi Wash & Ink** (`#fff3e0` fill / `#7c3808` ink in light; `#2c2112` fill / `#f5c376` ink in dark): Tithi, Ekadashi countdown, and Parana fast-break window pills.

### Tertiary
- **Tulasi Leaf Green** (`#246a28` light / `#3fc07a` dark): Cloud sync status dot.
- **Mint Completion Wash & Ink** (`#dcfae5` fill / `#04250e` ink in light; `#162b20` fill / `#6ce0a0` ink in dark): Calendar day Sadhana completion badges (`16r`, `12r`).
- **Sindoor Alert Red** (`#a12016` light / `#e5566f` dark): Reserved strictly for destructive or system errors, never for incomplete Sadhana days.

### Neutral
- **Sandalwood Chrome & Tonal Panel** (`#f3efe6` light / `#0c0d0c` chrome & `#1b1e1c` panel in dark): Outer L-frame shell and workspace tonal panels.
- **Parchment Inset Sheet & Row** (`#fbf9f5` light / `#141615` dark): Main inset workspace sheet, feed row cards, and default calendar day cells.
- **Pure Raised Card** (`#ffffff` light / `#222624` dark): Single inner Japa stepper card, form inputs, and selected calendar day cell.
- **Charcoal & Alabaster Ink** (`#1c201e` light / `#f3f2ee` dark): Primary text and numerical figures.
- **Warm Secondary Stone** (`#575652` light / `#b0aea8` dark): Secondary labels, Tithi subtitles, and timestamps.
- **Borders & Controls** (`#e2ddd2` border, `#ebe6dc` rule, `#cfc9bc` control in light; `#2a2e2c` border, `#222624` rule, `#3a3f3c` control in dark): Hairline structural dividers and form strokes.

### Named Rules
**The Mercy Over Gamification Rule.** Never use `--negative` (`#a12016` / `#e5566f`) for incomplete Japa rounds or unlogged calendar days; unfinished practice stays in calm neutral stone or warm marigold.
**The True-Neutral Dark Rule.** Dark Mode (`[data-theme='dark']`) uses low-chroma obsidian-charcoal grounds (`#0c0d0c`, `#141615`, `#1b1e1c`) with `color-scheme: dark`, avoiding saturated navy or glowing neon borders.

## Typography

**Display Font:** `Instrument Serif` (with `Georgia, serif` fallback)
**Body & UI Font:** `Instrument Sans` (with `system-ui, -apple-system, sans-serif` fallback)

**Character:** `Instrument Serif` brings a warm editorial greeting to the top of the almanac, while `Instrument Sans` with `font-variant-numeric: tabular-nums` keeps every round counter, Parana window, and calendar cell crisp and scannable.

### Hierarchy
- **Display Greeting (`h1`)** (`400`, `42px` desktop / `34px` tablet / `24px` phone, `line-height: 1.06`, `-0.01em`): Opening devotional greeting.
- **Japa Stepper Readout** (`400`, `36px`, `line-height: 1`): Primary round counter inside the Daily Japa Counter card.
- **KPI Headline Figure** (`400`, `32px` desktop / `26px` phone, `line-height: 1.05`): Top four summary tile numbers.
- **Section Panel Title** (`600`, `14px`, `line-height: 1.35`): Tonal panel headers and YouTube lecture titles.
- **Body & Feed Row Title** (`400`–`500`, `14px`, `line-height: 1.45`): Navigation items, primary buttons, and reading log titles.
- **Compact Control & Table Copy** (`500`, `13px`, `line-height: 1.35`): Secondary pill buttons, calendar day numbers, OAuth buttons, and form inputs.
- **Almanac Label & Chip** (`500`, `12px`, `line-height: 1.35`): Tithi badges, count chips, and metadata captions.
- **Micro Calendar Tag** (`500`–`600`, `11px`, `line-height: 1.2`): Calendar cell Tithi sublines, festival tags, and chart axis ticks.

### Named Rules
**The Single Serif Voice Rule.** `Instrument Serif` appears only on the `h1` greeting; all counters, titles, and calendar cells use `Instrument Sans`.
**The Regular-Weight KPI Rule.** Large numerical counters (`36px` Japa readout and `32px` KPI figures) stay at regular weight (`400`) with `tabular-nums`.

## Layout

The desktop layout uses a `224px` fixed left sidebar and a `48px` top bar framing an inset sheet (`margin: 0 8px 8px 0`, `padding: 36px 24px 48px`). Inside the sheet, `.workspace-container` centers an `1100px` max-width 12-column CSS Grid (`gap: 16px`, vertical stack `gap: 28px`):
- **Row 1:** Greeting header + quick-action pill cluster.
- **Row 2:** Four `span-3` KPI tiles (`128px` height).
- **Row 3 (`8 + 4` split):** Simplified Daily Japa Counter + Shastra Reading Log (`span-8`) paired with the Sravanam YouTube Shelf (`span-4`).
- **Row 4 (Full width):** ISKCON Vaishnava Calendar Engine (`6`-column day grid on desktop, `5`-column on tablet, `3`-column on phone).
- **Row 5 (`6 + 6` split):** Mananam Daily Reflection Journal (`span-6`) paired with One-Click Cloud Sync & 14-Day SVG Bar Chart (`span-6`).

At `<= 1024px`, the sidebar folds into a fixed `58px` 5-column bottom navigation bar (`Today`, `+1 Round`, `Calendar`, `+ YouTube`, `Dark`/`Light`). At `<= 640px` (`390px` phone), `.grid-12` collapses to a single `minmax(0, 1fr)` column while `.kpi-grid-section` forms a `2 × 2` grid.

## Elevation & Depth

Sadhana Valli is strictly flat (`box-shadow: none`). Hierarchy is expressed through three-tier tonal paper nesting:
1. **Outer Chrome & Tonal Panels (`--chrome-bg` / `--surface`):** `#f3efe6` in Light Mode; `#0c0d0c` chrome and `#1b1e1c` panels in Dark Mode.
2. **Inset Sheet & Feed Rows (`--sheet-bg`):** `#fbf9f5` in Light Mode; `#141615` in Dark Mode, bounded by `1px solid var(--border)`.
3. **Raised Inner Card & Controls (`--raised`):** `#ffffff` in Light Mode; `#222624` in Dark Mode for the Japa stepper card, active calendar cell, and inputs.

### Named Rules
**The Zero-Drop-Shadow Rule.** Never apply `box-shadow` to cards, buttons, or calendar cells; separate surfaces by tonal step and `1px solid` borders.

## Shapes

- **Tonal Panels & KPI Tiles:** `22px` (`18px` / `16px` on phone)
- **Inset Workspace Sheet:** `16px` (`0px` full-bleed below `1024px`)
- **Raised Inner Card & YouTube Card:** `14px`
- **Feed Row Cards & Continuity Mini Box:** `12px`
- **Vaishnava Calendar Day Cells & OAuth Buttons:** `10px`
- **Inputs & Nav Buttons:** `8px`
- **Brand Mark & Date Select:** `6px`
- **Action Buttons, Progress Track & Chips:** `999px` full pill

## Components

### Buttons
- **Primary Pill (`.btn-primary-pill`):** `38px` height, `999px` radius, `var(--accent)` fill, `#ffffff` text, `:active { transform: scale(0.97) }`.
- **Secondary Pill (`.btn-secondary-pill`):** `38px` height, `999px` radius, `var(--raised)` fill, `1px solid var(--control)` border.
- **One-Click OAuth Button (`.oauth-btn`):** `40px` height, `10px` radius, `var(--raised)` default or `var(--accent-soft)` when connected.

### Simplified Daily Japa Counter (`.white-inner-card`)
- Single raised container holding the `36px` round count, `-1` / `+1 Round` / `+4 Rounds` / `16 Done` pill controls, a `12px`-tall rounded progress track (`.japa-progress-track`), and the `Chanted before 07:00 AM` checkbox.

### ISKCON Vaishnava Calendar Cell (`.calendar-day-cell`)
- `10px` radius, `min-height: 76px`, `1px solid var(--border)` on `var(--sheet-bg)`. Selected date uses `2px solid var(--accent)` on `var(--raised)`; Ekadashi days use `var(--pill-warning-bg)` with `var(--warning)` border and a `cal-sadhana-dot` (`16r`) in `var(--pill-positive-bg)`.

### Inputs & Checkboxes
- `36px` height (`8px` radius) on `var(--raised)` with `1px solid var(--control)`, `caret-color: var(--accent)`, and `accent-color: var(--accent)` on checkboxes.

## Do's and Don'ts

### Do:
- **Do** support both Light Mode and Dark Mode (`[data-theme="dark"]`) with `color-scheme` and `accent-color: var(--accent)` so native controls match the theme.
- **Do** keep Japa logging to a single-card stepper and progress bar reachable via `Space` or one tap.
- **Do** display full city names (e.g., `New York`, `Los Angeles`, `Sri Mayapur`) in Parana fast-break windows.

### Don't:
- **Don't** reintroduce the 16-box time-band or Granthi matrix.
- **Don't** require users to paste database REST URLs or API keys; keep Cloud Sync to one-click OAuth and JSON backup.
- **Don't** use red error styling for incomplete Sadhana days.
