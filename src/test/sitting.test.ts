import { describe, expect, it } from 'vitest';
import {
  applySitting,
  canStartSitting,
  groveView,
  pendingDatesWhileSignedOut,
  recordsAfterSittingLoad,
  settleSitting,
  sittingsAfterLoad,
  todayVow,
  vowLine,
} from '../sitting';

describe('settleSitting', () => {
  it('withers only after the page has been hidden for more than 5 seconds', () => {
    expect(
      settleSitting({
        result: 'in-progress',
        elapsedMs: 60_000,
        lengthMinutes: 20,
        hiddenMs: 4_000,
        endedEarly: false,
      })
    ).toBe('in-progress');
    expect(
      settleSitting({
        result: 'in-progress',
        elapsedMs: 60_000,
        lengthMinutes: 20,
        hiddenMs: 6_000,
        endedEarly: false,
      })
    ).toBe('withered');
  });

  it('grows when the timer finishes on a visible page', () => {
    expect(
      settleSitting({
        result: 'in-progress',
        elapsedMs: 20 * 60_000,
        lengthMinutes: 20,
        hiddenMs: 0,
        endedEarly: false,
      })
    ).toBe('grown');
  });

  it('withers when the sitting is ended early', () => {
    expect(
      settleSitting({
        result: 'in-progress',
        elapsedMs: 60_000,
        lengthMinutes: 20,
        hiddenMs: 0,
        endedEarly: true,
      })
    ).toBe('withered');
  });

  it('keeps a finished plant', () => {
    expect(
      settleSitting({
        result: 'grown',
        elapsedMs: 0,
        lengthMinutes: 20,
        hiddenMs: 9_000,
        endedEarly: true,
      })
    ).toBe('grown');
  });
});

describe('sittingsAfterLoad', () => {
  it('a reload withers an unfinished sitting and keeps a finished one', () => {
    expect(
      sittingsAfterLoad([
        { id: 'a', minutes: 20, result: 'in-progress' },
        { id: 'b', minutes: 10, result: 'grown' },
      ])
    ).toEqual([
      { id: 'a', minutes: 20, result: 'withered' },
      { id: 'b', minutes: 10, result: 'grown' },
    ]);
  });
});

describe('applySitting', () => {
  it('saves the sprout without changing rounds or beads', () => {
    const record = { sittings: [], completedRounds: 3, beadsInRound: 40 };
    expect(applySitting(record, { id: 'a', minutes: 20, result: 'withered' })).toMatchObject({
      completedRounds: 3,
      beadsInRound: 40,
      sittings: [{ id: 'a', minutes: 20, result: 'withered' }],
    });
  });
});

describe('groveView', () => {
  it("keeps yesterday's plant in the count when today's sprout dies", () => {
    expect(
      groveView(
        [
          { date: '2026-10-31', sittings: [{ id: 'old', minutes: 20, result: 'grown' }] },
          { date: '2026-11-01', sittings: [{ id: 'new', minutes: 20, result: 'withered' }] },
        ],
        '2026-11'
      )
    ).toEqual({
      marks: [{ id: 'new', result: 'withered' }],
      livingCount: 1,
    });
  });
});

describe('vowLine', () => {
  it("shows the vow line only while today's vow is short and not skipped", () => {
    expect(
      vowLine({
        completedRounds: 4,
        targetRounds: 16,
        skippedDate: null,
        today: '2026-11-05',
        sittingStartedThisVisit: false,
      })
    ).toEqual({ show: true, roundsLeft: 12, text: '12 rounds are left' });
    expect(
      vowLine({
        completedRounds: 16,
        targetRounds: 16,
        skippedDate: null,
        today: '2026-11-05',
        sittingStartedThisVisit: false,
      }).show
    ).toBe(false);
    expect(
      vowLine({
        completedRounds: 4,
        targetRounds: 16,
        skippedDate: '2026-11-05',
        today: '2026-11-05',
        sittingStartedThisVisit: false,
      }).show
    ).toBe(false);
    expect(
      vowLine({
        completedRounds: 4,
        targetRounds: 16,
        skippedDate: '2026-11-05',
        today: '2026-11-06',
        sittingStartedThisVisit: false,
      }).show
    ).toBe(true);
  });
});

describe('reload wither survives a signed-in snapshot', () => {
  it('marks only the in-progress day withered and keeps that day pending while signed out', () => {
    const loaded = recordsAfterSittingLoad([
      {
        date: '2026-11-05',
        sittings: [{ id: 'live', minutes: 10 as const, result: 'in-progress' as const }],
      },
      {
        date: '2026-11-04',
        sittings: [{ id: 'old', minutes: 20 as const, result: 'grown' as const }],
      },
    ]);
    expect(loaded.records[0].sittings?.[0].result).toBe('withered');
    expect(loaded.records[1].sittings?.[0].result).toBe('grown');
    expect(loaded.withered.map((day) => day.date)).toEqual(['2026-11-05']);
    expect(
      pendingDatesWhileSignedOut(
        loaded.withered.map((day) => day.date),
        new Set(loaded.withered.map((day) => day.date))
      )
    ).toEqual(['2026-11-05']);
  });
});

describe('todayVow', () => {
  it('uses today, not another day, and comes back after a sitting when the page is visible again', () => {
    const records = [
      { date: '2026-11-05', completedRounds: 16, targetRounds: 16 },
      { date: '2026-11-06', completedRounds: 4, targetRounds: 16 },
    ];
    expect(todayVow(records, '2026-11-06', null, false).text).toBe('12 rounds are left');
    expect(todayVow(records, '2026-11-06', null, true).show).toBe(false);
    expect(todayVow(records, '2026-11-06', '2026-11-05', false).show).toBe(true);
  });
});

describe('canStartSitting', () => {
  it('stops at 20 sittings so a later save is not rejected', () => {
    const full = Array.from({ length: 20 }, (_, index) => ({
      id: `s-${index}`,
      minutes: 10 as const,
      result: 'withered' as const,
    }));
    expect(canStartSitting(full)).toBe(false);
    expect(canStartSitting(full.slice(0, 19))).toBe(true);
  });
});
