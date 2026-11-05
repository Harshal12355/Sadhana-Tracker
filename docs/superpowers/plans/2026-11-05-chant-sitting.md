# Chant Sitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 20-minute sitting on the bead screen grows a sprout that dies if you leave, finished sittings stay in a grove, and a short vow shows a line when the app is opened.

**Architecture:** `settleSitting` is the only place a sprout changes. The day record stores `sittings`. The grove and the vow line are views over that list and today's rounds. No clock-time notification is sent.

**Tech Stack:** React 19, TypeScript, Vitest, the existing `DailySadhanaRecord`, `mergeDailyRecords`, and `firestore.rules`.

**Spec:** `docs/superpowers/specs/2026-11-05-chant-sitting-design.md`

## Global Constraints

- Lengths are 10, 20, and 30 minutes. 20 is the selected default.
- Hiding the page for more than 5 seconds withers the sprout. 5 seconds or less does not.
- A sitting is saved as `in-progress` when it starts. It becomes `grown` only when its timer is seen to finish on a visible page. A reload of `in-progress` becomes `withered`.
- Ending a sitting from inside the app before the timer ends, including **Done** on the bead screen, withers it. After it is `grown`, **Done** only closes the screen.
- Withering does not change `completedRounds` or `beadsInRound`.
- The month strip shows this month's `grown` and `withered` sittings. The number beside it is every `grown` sitting so far. `in-progress` is not a plant or a stump.
- The vow line reads `${roundsLeft} rounds are left` and offers **Start a sitting**. It shows when the app is opened or brought back, rounds are below the target, and today was not skipped.
- **Skip today** hides the line until tomorrow on this phone. It does not change the vow.
- Sync: if either sitting is `withered`, the result is `withered`. If either is `grown` and neither is `withered`, the result is `grown`. Otherwise `in-progress`.
- Firestore must allow `sittings`. This plan does not deploy the rules.
- No clock-time notification. No streak. Do not remove `+1 Round`, `+4 Rounds`, or `16 Done`.
- The branch is cut from `feat/bead-counter`. The pull request is new.

## Review Focus

1. **A hide of 4 seconds** must leave the sprout growing, and a hide of 6 seconds must wither it. (Pinned in Task 1 `withers only after the page has been hidden for more than 5 seconds`)
2. **A reload** of an unfinished sitting must become a stump, and a finished plant must stay finished. (Pinned in Task 1 `a reload withers an unfinished sitting and keeps a finished one`)
3. **Yesterday's plant** must still count after today's sprout dies, including on the 1st of a month. (Pinned in Task 1 `keeps yesterday's plant in the count when today's sprout dies`)
4. **4 of 16 rounds** must show `12 rounds are left`, 16 rounds must hide the line, and skip today must hide it only until tomorrow. (Pinned in Task 1 `shows the vow line only while today's vow is short and not skipped`)
5. **A withered sitting** must not be revived by another device that still has it as grown. (Pinned in Task 1 `a withered sitting stays withered across sync`)

---

### Task 1: Sitting rules, grove count, vow line, sync

**Files:**
- Create: `src/sitting.ts`
- Modify: `src/sadhanaData.ts` (`DailySadhanaRecord`)
- Modify: `src/firebase/sadhanaSync.ts` (`mergeDailyRecords`)
- Modify: `firestore.rules`
- Test: `src/test/sitting.test.ts`
- Test: `src/test/sadhanaSync.test.ts`
- Test: `src/test/firestoreRules.test.ts`

**Interfaces:**
- Consumes: `mergeDailyRecords(local, remote)`.
- Produces:
  - `Sitting = { id: string; minutes: 10 | 20 | 30; result: 'in-progress' | 'grown' | 'withered' }`
  - `settleSitting(state: { result: Sitting['result']; elapsedMs: number; lengthMinutes: Sitting['minutes']; hiddenMs: number; endedEarly: boolean }): Sitting['result']`
  - `sittingsAfterLoad(sittings: Sitting[] | undefined): Sitting[]`
  - `applySitting<T extends { sittings?: Sitting[]; completedRounds: number; beadsInRound?: number }>(record: T, sitting: Sitting): T`
  - `groveView(days: { date: string; sittings?: Sitting[] }[], month: string): { marks: { id: string; result: 'grown' | 'withered' }[]; livingCount: number }`
  - `vowLine(input: { completedRounds: number; targetRounds: number; skippedDate: string | null; today: string; sittingStartedThisVisit: boolean }): { show: boolean; roundsLeft: number; text: string }`
  - `HIDE_GRACE_MS = 5000`

- [ ] **Step 1: Write the failing tests**

Create `src/test/sitting.test.ts` with these assertions:

```ts
expect(settleSitting({ result: 'in-progress', elapsedMs: 60_000, lengthMinutes: 20, hiddenMs: 4_000, endedEarly: false })).toBe('in-progress');
expect(settleSitting({ result: 'in-progress', elapsedMs: 60_000, lengthMinutes: 20, hiddenMs: 6_000, endedEarly: false })).toBe('withered');
expect(settleSitting({ result: 'in-progress', elapsedMs: 20 * 60_000, lengthMinutes: 20, hiddenMs: 0, endedEarly: false })).toBe('grown');
expect(settleSitting({ result: 'in-progress', elapsedMs: 60_000, lengthMinutes: 20, hiddenMs: 0, endedEarly: true })).toBe('withered');
expect(settleSitting({ result: 'grown', elapsedMs: 0, lengthMinutes: 20, hiddenMs: 9_000, endedEarly: true })).toBe('grown');

expect(sittingsAfterLoad([{ id: 'a', minutes: 20, result: 'in-progress' }, { id: 'b', minutes: 10, result: 'grown' }])).toEqual([
  { id: 'a', minutes: 20, result: 'withered' },
  { id: 'b', minutes: 10, result: 'grown' },
]);

const record = { sittings: [], completedRounds: 3, beadsInRound: 40 };
expect(applySitting(record, { id: 'a', minutes: 20, result: 'withered' })).toMatchObject({
  completedRounds: 3,
  beadsInRound: 40,
  sittings: [{ id: 'a', minutes: 20, result: 'withered' }],
});

expect(groveView([
  { date: '2026-10-31', sittings: [{ id: 'old', minutes: 20, result: 'grown' }] },
  { date: '2026-11-01', sittings: [{ id: 'new', minutes: 20, result: 'withered' }] },
], '2026-11')).toEqual({
  marks: [{ id: 'new', result: 'withered' }],
  livingCount: 1,
});

expect(vowLine({ completedRounds: 4, targetRounds: 16, skippedDate: null, today: '2026-11-05', sittingStartedThisVisit: false })).toEqual({ show: true, roundsLeft: 12, text: '12 rounds are left' });
expect(vowLine({ completedRounds: 16, targetRounds: 16, skippedDate: null, today: '2026-11-05', sittingStartedThisVisit: false }).show).toBe(false);
expect(vowLine({ completedRounds: 4, targetRounds: 16, skippedDate: '2026-11-05', today: '2026-11-05', sittingStartedThisVisit: false }).show).toBe(false);
expect(vowLine({ completedRounds: 4, targetRounds: 16, skippedDate: '2026-11-05', today: '2026-11-06', sittingStartedThisVisit: false }).show).toBe(true);
```

Append to `src/test/sadhanaSync.test.ts`: a newer `grown` sitting and an older `withered` sitting with the same id merge to `withered`.

Append to `src/test/firestoreRules.test.ts`: the rules contain `'sittings'` and `in-progress`, `grown`, and `withered`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/test/sitting.test.ts src/test/sadhanaSync.test.ts src/test/firestoreRules.test.ts`

Expected: FAIL because `src/sitting.ts` does not exist and the rules do not mention `sittings`.

- [ ] **Step 3: Implement the rules**

Add optional `sittings?: Sitting[]` to `DailySadhanaRecord`.

Implement the functions in `src/sitting.ts` so the sitting tests pass. `settleSitting` treats `hiddenMs > HIDE_GRACE_MS` as withered, `endedEarly` as withered, and `elapsedMs >= lengthMinutes * 60_000` on a sitting that was not withered as grown. Terminal `grown` stays `grown`. Terminal `withered` stays `withered`. `groveView` ignores `in-progress`. `vowLine` shows only when `completedRounds < targetRounds`, `skippedDate !== today`, and `sittingStartedThisVisit` is false.

In `mergeDailyRecords`, union `sittings` by `id`. Same id uses the withered-wins rule above.

In `firestore.rules`, allow `sittings` on a day: a list of at most 20 maps, each with `id` (string, at most 80 chars), `minutes` (10, 20, or 30), and `result` (`in-progress`, `grown`, or `withered`). The field is optional.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/test/sitting.test.ts src/test/sadhanaSync.test.ts src/test/firestoreRules.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sitting.ts src/sadhanaData.ts src/firebase/sadhanaSync.ts firestore.rules src/test/sitting.test.ts src/test/sadhanaSync.test.ts src/test/firestoreRules.test.ts
git commit -m "$(cat <<'EOF'
feat: decide when a chant sitting grows or withers

Leaving the page has to kill only this sprout, and a finished plant has to still be there tomorrow.
EOF
)"
```

---

### Task 2: Sitting on the bead screen, grove on the day

**Files:**
- Create: `src/components/SittingGrove.tsx`
- Modify: `src/components/BeadChantScreen.tsx`
- Modify: `src/App.tsx` (record load around the `STORAGE_KEY` initializer, bead screen props, daily page)
- Test: `src/test/sittingGrove.test.tsx`
- Test: `src/test/beadChantScreen.test.tsx`

**Interfaces:**
- Consumes: `Sitting`, `groveView`, `settleSitting`, `sittingsAfterLoad`, `applySitting`.
- Produces: `SittingGrove` props `{ marks: { id: string; result: 'grown' | 'withered' }[]; livingCount: number }`. `BeadChantScreen` gains `sitting: Sitting | null`, `sprout: 'Seed' | 'Sprout' | null`, `onStartSitting: (minutes: 10 | 20 | 30) => void`, `onGiveUp: () => void`. `sprout` is `Seed` for the first half of the length and `Sprout` after that. App computes it from `elapsedMs`.

- [ ] **Step 1: Write the failing tests**

`SittingGrove` with one grown mark and one withered mark renders `Living plant`, `Stump`, and `1 living plant`.

`BeadChantScreen` with `sitting={null}` renders a way to start 10, 20, and 30 minutes, and the text `Start a sitting`. With an `in-progress` 20-minute sitting and `sprout="Seed"` it renders `Seed` and does not offer a second start. With `sprout="Sprout"` it renders `Sprout`. The existing bead, back, and done assertions still pass.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/test/sittingGrove.test.tsx src/test/beadChantScreen.test.tsx`

Expected: FAIL because `SittingGrove` does not exist and the bead screen has no start control.

- [ ] **Step 3: Build the grove and the start control**

`SittingGrove` lists each mark as `Living plant` or `Stump`, then the text `${livingCount} living plant` or `${livingCount} living plants`.

On the bead screen, `sitting === null` shows **Start a sitting** and the three lengths. An `in-progress` sitting shows `Seed` or `Sprout` and keeps **Done**. `onGiveUp` is **Done** while the result is `in-progress`. `onStartSitting(20)` is the default length control.

In `App.tsx`, the first read from `STORAGE_KEY` passes each day's sittings through `sittingsAfterLoad`. Starting a sitting appends `{ id, minutes, result: 'in-progress' }` through `applySitting`. A `visibilitychange` to hidden records the time. On visible, `hiddenMs` feeds `settleSitting`. A timer checks `elapsedMs` the same way. **Done** during `in-progress` calls `settleSitting` with `endedEarly: true`, saves, then closes. **Done** after `grown` only closes.

The daily page renders `SittingGrove` from `groveView` for the selected month.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/test/sittingGrove.test.tsx src/test/beadChantScreen.test.tsx src/test/sitting.test.ts`

Expected: PASS.

- [ ] **Step 5: Check the sitting in the browser**

Run: `npm run build`

Open `http://localhost:8000/`, choose **Continue in Local Offline Mode**, then **Count on beads**, then **Start a sitting** at 10 minutes.

Expected: the sitting is underway. Reload the page, open the grove: that sitting is a stump. Start another sitting and let the test above cover the timer. Do not wait out 10 real minutes in this step. The unit test owns the timer.

- [ ] **Step 6: Commit**

```bash
git add src/components/SittingGrove.tsx src/components/BeadChantScreen.tsx src/App.tsx src/test/sittingGrove.test.tsx src/test/beadChantScreen.test.tsx
git commit -m "$(cat <<'EOF'
feat: grow a sprout while a chant sitting stays open

Leaving the page turns this sitting into a stump, and the plants from finished sittings stay on the day.
EOF
)"
```

---

### Task 3: Vow line

**Files:**
- Create: `src/components/VowLine.tsx`
- Modify: `src/App.tsx` (top of the daily page, after the login gate)
- Test: `src/test/vowLine.test.tsx`

**Interfaces:**
- Consumes: `vowLine`.
- Produces: `VowLine` props `{ text: string; onStart: () => void; onSkip: () => void }`.

- [ ] **Step 1: Write the failing test**

`VowLine` with `text="12 rounds are left"` renders that text, **Start a sitting**, and **Skip today**.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/vowLine.test.tsx`

Expected: FAIL because `VowLine` does not exist.

- [ ] **Step 3: Show the line when the vow is short**

Render `VowLine` at the top of the daily page when `vowLine(...).show` is true. `onStart` opens the bead screen. `onSkip` stores today's date in `localStorage` under `sadhana_valli_vow_skip` and hides the line. Read that key back as `skippedDate`.

Also run `vowLine` when `document.visibilityState` becomes `visible`, so coming back to the app can show the line again. Starting a sitting sets `sittingStartedThisVisit` for this page life only.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/vowLine.test.tsx src/test/sitting.test.ts`

Expected: PASS.

- [ ] **Step 5: Check the line in the browser**

The built app on `http://localhost:8000/` with 0 of 16 rounds shows `16 rounds are left` and **Start a sitting** above the daily page. **Skip today** removes it. Reload: it stays gone. This step does not change the computer's date, so the next-day return is the unit test from Task 1.

- [ ] **Step 6: Commit**

```bash
git add src/components/VowLine.tsx src/App.tsx src/test/vowLine.test.tsx
git commit -m "$(cat <<'EOF'
feat: show the rounds still left when the app opens

The line is the reminder a closed phone cannot send, and it stays quiet once today's vow is met.
EOF
)"
```
