import { describe, it, expect, vi, afterEach } from 'vitest';
import { mergeDailyRecords, mergeRecordLists } from '../firebase/sadhanaSync';
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
