# Bead Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a page-sized bead button so one tap is one name, 108 names add one round on today's log, and volume-up counts on phones that hand the key over.

**Architecture:** `stepBead` is the only place a bead changes rounds. The day record stores `beadsInRound` and the existing Firestore merge keeps it. A chant screen calls `stepBead`. Volume-up is a key test in front of that same function. iPhone and iPad never enable the switch.

**Tech Stack:** React 19, TypeScript, Vitest, the existing `DailySadhanaRecord` and `mergeDailyRecords`.

**Spec:** `docs/superpowers/specs/2026-11-05-bead-counter-design.md`

## Global Constraints

- `beadsInRound` is 0 to 107. A missing field counts as 0.
- The 108th bead sets `beadsInRound` to 0 and adds 1 to `completedRounds`, capped at 64.
- One bead back from 0, when rounds are at least 1, sets rounds down by 1 and beads to 107. Otherwise beads stop at 0.
- `-1` round does not change `beadsInRound`.
- While the chant screen is open, Space is one bead, not one round.
- Volume up counts one bead only when the switch is on. Volume down does not count.
- iPhone and iPad keep the switch off. The line is `This phone will not hand over the volume buttons.`
- The screen asks the phone to stay awake. If that is refused, the button still works.
- When both records have `beadsInRound`, the newer one wins, including 0. When the newer record has no field, keep the older count. Rounds still use the higher number.
- The mantra total is `completedRounds * 108 + beadsInRound`.
- Do not remove `+1 Round`, `+4 Rounds`, or `16 Done`.

## Review Focus

1. **The 108th bead** must add one round and show 0, not 108 stuck on screen. (Pinned in Task 1 `adds a round on the 108th bead and returns to 0`)
2. **Back one bead from 0 after a finished round** must restore bead 107 and remove that round. A mis-tap at the boundary has to be undoable. (Pinned in Task 1 `undoes the round boundary`)
3. **A newer save that never wrote `beadsInRound`** must not wipe bead 40 on the other device. (Pinned in Task 1 `keeps the older bead count when the newer record has no field`)
4. **An iPad that reports itself as a Mac** must not offer volume buttons. (Pinned in Task 2 `hides volume buttons on iPhone and iPad`)
5. **Volume down** must not count a bead. (Pinned in Task 2 `counts only volume up`)

---

### Task 1: Bead math and sync

**Files:**
- Create: `src/beadCount.ts`
- Modify: `src/sadhanaData.ts` (`DailySadhanaRecord`)
- Modify: `src/firebase/sadhanaSync.ts` (`mergeDailyRecords`)
- Test: `src/test/beadCount.test.ts`
- Test: `src/test/sadhanaSync.test.ts`

**Interfaces:**
- Consumes: `mergeDailyRecords(local, remote)` and `DailySadhanaRecord`.
- Produces:
  - `DailySadhanaRecord.beadsInRound?: number`
  - `stepBead(state: { completedRounds: number; beadsInRound?: number }, delta: 1 | -1): { completedRounds: number; beadsInRound: number }`
  - `mantraTotal(completedRounds: number, beadsInRound?: number): number`
  - `BEADS_PER_ROUND = 108`, `MAX_ROUNDS = 64`

- [ ] **Step 1: Write the failing tests**

Create `src/test/beadCount.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mantraTotal, stepBead } from '../beadCount';

describe('stepBead', () => {
  it('adds a round on the 108th bead and returns to 0', () => {
    expect(stepBead({ completedRounds: 3, beadsInRound: 107 }, 1)).toEqual({
      completedRounds: 4,
      beadsInRound: 0,
    });
  });

  it('counts a missing field as 0', () => {
    expect(stepBead({ completedRounds: 0 }, 1)).toEqual({
      completedRounds: 0,
      beadsInRound: 1,
    });
  });

  it('undoes the round boundary', () => {
    expect(stepBead({ completedRounds: 1, beadsInRound: 0 }, -1)).toEqual({
      completedRounds: 0,
      beadsInRound: 107,
    });
  });

  it('does not go below 0 beads when there is no round to undo', () => {
    expect(stepBead({ completedRounds: 0, beadsInRound: 0 }, -1)).toEqual({
      completedRounds: 0,
      beadsInRound: 0,
    });
  });

  it('does not raise rounds past 64', () => {
    expect(stepBead({ completedRounds: 64, beadsInRound: 107 }, 1)).toEqual({
      completedRounds: 64,
      beadsInRound: 0,
    });
  });

  it('counts the partial round in the mantra total', () => {
    expect(mantraTotal(3, 37)).toBe(3 * 108 + 37);
    expect(mantraTotal(2)).toBe(216);
  });
});
```

Append to `src/test/sadhanaSync.test.ts` inside `describe('mergeDailyRecords')`:

```ts
  it('uses the newer bead count, including 0', () => {
    const base = INITIAL_SADHANA_HISTORY[0];
    const newer = { ...base, beadsInRound: 0, updatedAt: '2026-11-05T09:00:00.000Z' };
    const older = { ...base, beadsInRound: 40, updatedAt: '2026-11-05T07:00:00.000Z' };
    expect(mergeDailyRecords(older, newer).beadsInRound).toBe(0);
    expect(mergeDailyRecords(newer, older).beadsInRound).toBe(0);
  });

  it('keeps the older bead count when the newer record has no field', () => {
    const base = INITIAL_SADHANA_HISTORY[0];
    const newer = { ...base, updatedAt: '2026-11-05T09:00:00.000Z' };
    const older = { ...base, beadsInRound: 40, updatedAt: '2026-11-05T07:00:00.000Z' };
    expect(mergeDailyRecords(older, newer).beadsInRound).toBe(40);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/test/beadCount.test.ts src/test/sadhanaSync.test.ts`

Expected: FAIL because `../beadCount` does not exist, and `beadsInRound` is not asserted by the current merge.

- [ ] **Step 3: Implement the math and the merge**

Add optional `beadsInRound?: number` to `DailySadhanaRecord`.

Create `src/beadCount.ts` with `BEADS_PER_ROUND`, `MAX_ROUNDS`, `stepBead`, and `mantraTotal` so the bead tests pass. Clamp a wild `beadsInRound` into 0..107 before stepping.

In `mergeDailyRecords`, set `beadsInRound` to the newer record's number when that field is a number, otherwise the older record's number, otherwise 0. Clamp to 0..107.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/test/beadCount.test.ts src/test/sadhanaSync.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/beadCount.ts src/sadhanaData.ts src/firebase/sadhanaSync.ts src/test/beadCount.test.ts src/test/sadhanaSync.test.ts
git commit -m "$(cat <<'EOF'
feat: count 108 beads as one saved round

A half-finished round has to survive reload and sync, and the 108th name has to land on today's rounds.
EOF
)"
```

---

### Task 2: Volume key and Space

**Files:**
- Create: `src/chantInput.ts`
- Test: `src/test/chantInput.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `spaceAction(chantOpen: boolean, tagName: string): 'bead' | 'round' | 'ignore'`
  - `isVolumeUpKey(event: { key: string; code: string }): boolean`
  - `volumeButtonsAvailable(env: { userAgent: string; maxTouchPoints: number }): boolean`
  - `requestChantWakeLock(nav: { wakeLock?: { request: (type: 'screen') => Promise<unknown> } }): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

Create `src/test/chantInput.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  isVolumeUpKey,
  requestChantWakeLock,
  spaceAction,
  volumeButtonsAvailable,
} from '../chantInput';

describe('spaceAction', () => {
  it('counts a bead while the chant screen is open', () => {
    expect(spaceAction(true, 'BODY')).toBe('bead');
  });

  it('counts a round when the chant screen is closed', () => {
    expect(spaceAction(false, 'BODY')).toBe('round');
  });

  it('ignores space in a text field or on a button', () => {
    expect(spaceAction(true, 'INPUT')).toBe('ignore');
    expect(spaceAction(true, 'TEXTAREA')).toBe('ignore');
    expect(spaceAction(false, 'BUTTON')).toBe('ignore');
  });
});

describe('volume keys', () => {
  it('counts only volume up', () => {
    expect(isVolumeUpKey({ key: 'VolumeUp', code: '' })).toBe(true);
    expect(isVolumeUpKey({ key: 'AudioVolumeUp', code: '' })).toBe(true);
    expect(isVolumeUpKey({ key: '', code: 'VolumeUp' })).toBe(true);
    expect(isVolumeUpKey({ key: 'VolumeDown', code: 'VolumeDown' })).toBe(false);
    expect(isVolumeUpKey({ key: 'AudioVolumeDown', code: '' })).toBe(false);
  });

  it('hides volume buttons on iPhone and iPad', () => {
    expect(volumeButtonsAvailable({ userAgent: 'iPhone', maxTouchPoints: 5 })).toBe(false);
    expect(volumeButtonsAvailable({ userAgent: 'iPad', maxTouchPoints: 5 })).toBe(false);
    expect(
      volumeButtonsAvailable({ userAgent: 'Macintosh', maxTouchPoints: 5 })
    ).toBe(false);
    expect(
      volumeButtonsAvailable({ userAgent: 'Macintosh', maxTouchPoints: 0 })
    ).toBe(true);
    expect(volumeButtonsAvailable({ userAgent: 'Android', maxTouchPoints: 5 })).toBe(true);
  });
});

describe('requestChantWakeLock', () => {
  it('asks for a screen lock and still returns when the phone refuses', async () => {
    const request = vi.fn().mockResolvedValue({});
    await expect(requestChantWakeLock({ wakeLock: { request } })).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith('screen');
    await expect(requestChantWakeLock({})).resolves.toBe(false);
    await expect(
      requestChantWakeLock({ wakeLock: { request: vi.fn().mockRejectedValue(new Error('no')) } })
    ).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/chantInput.test.ts`

Expected: FAIL because `../chantInput` does not exist.

- [ ] **Step 3: Implement `src/chantInput.ts`**

`spaceAction`: tag `INPUT`, `TEXTAREA`, `SELECT`, or `BUTTON` returns `'ignore'`. Otherwise chant-open returns `'bead'` and chant-closed returns `'round'`.

`isVolumeUpKey`: true only for key or code `VolumeUp` or `AudioVolumeUp`.

`volumeButtonsAvailable`: false when the user agent contains `iPhone`, `iPad`, or `iPod`, or when it contains `Macintosh` and `maxTouchPoints > 1`. True otherwise.

`requestChantWakeLock`: call `nav.wakeLock.request('screen')` when `wakeLock` exists. Return true on success and false when it is missing or the request rejects.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/chantInput.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/chantInput.ts src/test/chantInput.test.ts
git commit -m "$(cat <<'EOF'
feat: decide when a key counts as one bead

Space on the chant screen is one name, volume down is not, and an iPhone cannot pretend to hear the volume buttons.
EOF
)"
```

---

### Task 3: Chant screen

**Files:**
- Create: `src/components/BeadChantScreen.tsx`
- Modify: `src/App.tsx` (japa panel, Space handler around line 705, `totalBeadsChanted` around line 578, both empty-day object literals)
- Test: `src/test/beadChantScreen.test.ts`

**Interfaces:**
- Consumes: `stepBead`, `mantraTotal`, `spaceAction`, `isVolumeUpKey`, `volumeButtonsAvailable`, `requestChantWakeLock`.
- Produces: `BeadChantScreen` with props:
  - `beadsInRound: number`
  - `completedRounds: number`
  - `volumeAllowed: boolean`
  - `volumeOn: boolean`
  - `onBead: () => void`
  - `onBack: () => void`
  - `onClose: () => void`
  - `onVolumeToggle: (on: boolean) => void`

- [ ] **Step 1: Write the failing test**

Create `src/test/beadChantScreen.test.ts`:

```ts
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BeadChantScreen } from '../components/BeadChantScreen';

const noop = () => {};

describe('BeadChantScreen', () => {
  it('shows the bead count and a page-sized tap', () => {
    const html = renderToStaticMarkup(
      <BeadChantScreen
        beadsInRound={37}
        completedRounds={3}
        volumeAllowed
        volumeOn={false}
        onBead={noop}
        onBack={noop}
        onClose={noop}
        onVolumeToggle={noop}
      />
    );
    expect(html).toContain('37 / 108');
    expect(html).toContain('One bead');
    expect(html).toContain('Back one bead');
    expect(html).toContain('Done');
    expect(html).toContain('3 rounds today');
    expect(html).toContain('Volume up counts');
  });

  it('keeps the volume switch off when the phone will not allow it', () => {
    const html = renderToStaticMarkup(
      <BeadChantScreen
        beadsInRound={0}
        completedRounds={0}
        volumeAllowed={false}
        volumeOn={false}
        onBead={noop}
        onBack={noop}
        onClose={noop}
        onVolumeToggle={noop}
      />
    );
    expect(html).toContain('This phone will not hand over the volume buttons.');
    expect(html).toContain('disabled');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/beadChantScreen.test.ts`

Expected: FAIL because `BeadChantScreen` does not exist.

- [ ] **Step 3: Build the screen and open it from the japa panel**

Create `BeadChantScreen` so the markup test passes. The tap target is a `button` whose accessible name is `One bead`. The volume control is a checkbox labelled `Volume up counts`, disabled when `volumeAllowed` is false, and the refusal sentence is rendered only then.

In `App.tsx`:

- `totalBeadsChanted` uses `mantraTotal`.
- A `Count on beads` button in the japa panel sets chant-open state.
- When open, render `BeadChantScreen` instead of the dashboard. `onBead` calls `stepBead(..., 1)` through `updateCurrentRecord`. `onBack` calls `stepBead(..., -1)`.
- `volumeAllowed` comes from `volumeButtonsAvailable` with `navigator.userAgent` and `navigator.maxTouchPoints`. The switch cannot turn on when that is false.
- When the switch is on, a `keydown` listener calls `stepBead(..., 1)` for `isVolumeUpKey`. Do not call `preventDefault` on that key.
- The Space listener uses `spaceAction`. `'bead'` calls `stepBead(..., 1)`. `'round'` keeps `adjustRounds(1)`. `'ignore'` does nothing.
- On open, call `requestChantWakeLock(navigator)` and release the lock on close when the returned sentinel has a `release` method. Ignore failure.
- Do not change `adjustRounds` or `setExactRounds`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/test/beadChantScreen.test.ts src/test/beadCount.test.ts src/test/chantInput.test.ts src/test/sadhanaSync.test.ts`

Expected: PASS.

- [ ] **Step 5: Check the screen in the browser**

The running app on port 8000 serves `dist/`. Rebuild and open the chant screen:

Run: `npm run build`

Open `http://localhost:8000/`, choose **Continue in Local Offline Mode**, then **Count on beads**.

Expected:

- The bead readout is `0 / 108`.
- One tap changes it to `1 / 108`.
- Reload: it is still `1 / 108`.
- **Back one bead** returns it to `0 / 108`.
- **Done** returns to the daily page, and `+1 Round` still adds a whole round.

- [ ] **Step 6: Commit**

```bash
git add src/components/BeadChantScreen.tsx src/test/beadChantScreen.test.ts src/App.tsx
git commit -m "$(cat <<'EOF'
feat: open a bead counter when the japa bag is at home

One tap is one name, 108 names become today's next round, and the count is still there after a reload.
EOF
)"
```
