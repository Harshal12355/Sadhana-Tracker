import { describe, it, expect, vi } from 'vitest';
import { mergeDailyRecords, mergeRecordLists } from '../firebase/sadhanaSync';
import { fetchCalendarMonth, resolveYouTubeViaApi } from '../api/backendClient';
import { INITIAL_SADHANA_HISTORY } from '../sadhanaData';

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
    vi.unstubAllGlobals();
  });

  it('falls back to local YouTube ID extraction when API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));
    const res = await resolveYouTubeViaApi('https://youtu.be/fbm_O3pD_3c');
    expect(res?.youtubeId).toBe('fbm_O3pD_3c');
    vi.unstubAllGlobals();
  });
});
