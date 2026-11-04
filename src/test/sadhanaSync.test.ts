import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  mergeDailyRecords,
  mergeRecordLists,
  processSnapshot,
  reconcileSnapshotWithSeed,
  type TimestampedSadhanaRecord,
} from '../firebase/sadhanaSync';
import { fetchCalendarMonth, resolveYouTubeViaApi } from '../api/backendClient';
import { INITIAL_SADHANA_HISTORY } from '../sadhanaData';

afterEach(() => {
  vi.unstubAllGlobals();
});

const lecture = (id: string) => ({
  id,
  youtubeUrl: `https://youtu.be/${id}`,
  youtubeId: 'fbm_O3pD_3c',
  title: id,
  speaker: 'Speaker',
  minutes: 10,
  timestampNote: '00:10',
  realization: '',
});

describe('mergeDailyRecords edge cases', () => {
  const base = { ...INITIAL_SADHANA_HISTORY[0], lectures: [], readings: [] };

  it('uses the newer updatedAt reflection when both are non-empty and differ', () => {
    const local = { ...base, reflection: 'old thought', updatedAt: '2026-11-02T07:00:00.000Z' };
    const remote = { ...base, reflection: 'new thought', updatedAt: '2026-11-02T09:00:00.000Z' };
    expect(mergeDailyRecords(local, remote).reflection).toBe('new thought');
    expect(mergeDailyRecords(remote, local).reflection).toBe('new thought');
  });

  it('keeps an identical reflection', () => {
    const a = { ...base, reflection: 'same', updatedAt: '2026-11-02T07:00:00.000Z' };
    const b = { ...base, reflection: 'same', updatedAt: '2026-11-02T09:00:00.000Z' };
    expect(mergeDailyRecords(a, b).reflection).toBe('same');
  });

  it('takes wakeTime from the newer record', () => {
    const local = { ...base, wakeTime: '04:30', updatedAt: '2026-11-02T07:00:00.000Z' };
    const remote = { ...base, wakeTime: '06:15', updatedAt: '2026-11-02T09:00:00.000Z' };
    expect(mergeDailyRecords(local, remote).wakeTime).toBe('06:15');
    expect(mergeDailyRecords(remote, local).wakeTime).toBe('06:15');
  });

  it("falls back to '05:00' when the newer wakeTime is empty", () => {
    const local = { ...base, wakeTime: '', updatedAt: '2026-11-02T09:00:00.000Z' };
    const remote = { ...base, wakeTime: '04:30', updatedAt: '2026-11-02T07:00:00.000Z' };
    expect(mergeDailyRecords(local, remote).wakeTime).toBe('05:00');
  });

  it('unions lectures by id without duplicates, newer record first', () => {
    const local = {
      ...base,
      lectures: [lecture('lec-a'), lecture('lec-shared')],
      updatedAt: '2026-11-02T09:00:00.000Z',
    };
    const remote = {
      ...base,
      lectures: [lecture('lec-shared'), lecture('lec-b')],
      updatedAt: '2026-11-02T07:00:00.000Z',
    };
    const merged = mergeDailyRecords(local, remote);
    expect(merged.lectures.map((l) => l.id)).toEqual(['lec-a', 'lec-shared', 'lec-b']);
  });

  it('treats missing updatedAt as oldest: a timestamped record wins', () => {
    const noStamp = { ...base, reflection: 'unstamped', wakeTime: '04:00' };
    const stamped = {
      ...base,
      reflection: 'stamped',
      wakeTime: '06:00',
      updatedAt: '2026-11-02T09:00:00.000Z',
    };
    const merged = mergeDailyRecords(noStamp, stamped);
    expect(merged.reflection).toBe('stamped');
    expect(merged.wakeTime).toBe('06:00');
    expect(merged.updatedAt).toBe('2026-11-02T09:00:00.000Z');
  });

  it('breaks ties in favour of local when both lack updatedAt', () => {
    const local = { ...base, reflection: 'local', wakeTime: '04:00' };
    const remote = { ...base, reflection: 'remote', wakeTime: '06:00' };
    const merged = mergeDailyRecords(local, remote);
    expect(merged.reflection).toBe('local');
    expect(merged.wakeTime).toBe('04:00');
    expect(merged.updatedAt).toBeUndefined();
  });
});

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
  });

  it('falls back to local YouTube ID extraction when API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));
    const res = await resolveYouTubeViaApi('https://youtu.be/fbm_O3pD_3c');
    expect(res?.youtubeId).toBe('fbm_O3pD_3c');
  });
});

describe('reconcileSnapshotWithSeed', () => {
  const seed = INITIAL_SADHANA_HISTORY.slice(0, 2).map((r) => ({ ...r }));
  const newPending = () =>
    new Map<string, TimestampedSadhanaRecord>(seed.map((r) => [r.date, r]));

  it('never empties the UI before backfill lands, and retires seeds afterwards', () => {
    const pending = newPending();
    const written = new Set<string>();

    // Snapshot 1: empty remote -> emit all seeds, schedule each write once.
    const s1 = reconcileSnapshotWithSeed([], pending, written);
    expect(s1.merged.map((r) => r.date)).toEqual(seed.map((r) => r.date));
    expect(s1.toWrite.length).toBe(2);

    // Snapshot 2: still empty (writes not landed) -> still emit seeds, no duplicate writes.
    const s2 = reconcileSnapshotWithSeed([], pending, written);
    expect(s2.merged.length).toBe(2);
    expect(s2.toWrite.length).toBe(0);

    // Snapshot 3: remote now holds the backfilled records -> seeds retired, no writes.
    const backfilled = seed.map((r) => ({ ...r, updatedAt: '2026-11-02T10:00:00.000Z' }));
    const s3 = reconcileSnapshotWithSeed(backfilled, pending, written);
    expect(s3.merged.length).toBe(2);
    expect(s3.toWrite.length).toBe(0);
    expect(pending.size).toBe(0);

    // Snapshot 4: user edited a day in Firestore -> edit wins, old seed not resurrected.
    const edited = backfilled.map((r, i) =>
      i === 0 ? { ...r, reflection: 'edited elsewhere', wakeTime: '06:30' } : r
    );
    const s4 = reconcileSnapshotWithSeed(edited, pending, written);
    expect(s4.merged[0].reflection).toBe('edited elsewhere');
    expect(s4.merged[0].wakeTime).toBe('06:30');
    expect(s4.toWrite.length).toBe(0);
  });

  it('merges a partial remote with remaining seeds and writes only what differs', () => {
    const pending = newPending();
    const written = new Set<string>();
    const partial = [{ ...seed[0], updatedAt: '2026-11-02T10:00:00.000Z' }];
    const s = reconcileSnapshotWithSeed(partial, pending, written);
    expect(s.merged.length).toBe(2);
    expect(s.toWrite.map((r) => r.date)).toEqual([seed[1].date]);
    expect(pending.has(seed[0].date)).toBe(false);
    expect(pending.has(seed[1].date)).toBe(true);
  });
});

describe('processSnapshot', () => {
  const seed = INITIAL_SADHANA_HISTORY.slice(0, 2).map((r) => ({ ...r }));
  const newPending = () =>
    new Map<string, TimestampedSadhanaRecord>(seed.map((r) => [r.date, r]));

  it('emits merged records but schedules no backfill from a cache snapshot', () => {
    const pending = newPending();
    const written = new Set<string>();
    const fromCache = processSnapshot([], true, pending, written);
    expect(fromCache.merged.length).toBe(2);
    expect(fromCache.toWrite).toEqual([]);
    expect(written.size).toBe(0);

    // The later server snapshot still backfills each date exactly once.
    const fromServer = processSnapshot([], false, pending, written);
    expect(fromServer.toWrite.length).toBe(2);
    expect(processSnapshot([], false, pending, written).toWrite.length).toBe(0);
  });
});
