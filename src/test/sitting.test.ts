import { describe, expect, it } from 'vitest';
import {
  applySitting,
  groveView,
  settleSitting,
  sittingsAfterLoad,
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
