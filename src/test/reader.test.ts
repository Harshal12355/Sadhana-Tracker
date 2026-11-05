import { describe, it, expect } from 'vitest';
import {
  READER_BOOKS,
  bookCodeForTitle,
  firstRef,
  flattenIndex,
  formatRef,
  formatRefRange,
  loadVerseIndex,
  nextRef,
  previousRef,
  resolveRef,
  vedabaseUrl,
  versesInRef,
} from '../reader/vedabase';

describe('in-app Shastra reader verse navigation', () => {
  it('steps through combined Gita verses and across chapters', async () => {
    const bg = await loadVerseIndex('bg');
    expect(firstRef(bg)).toBe('1/1');
    expect(nextRef(bg, '1/15')).toBe('1/16-18');
    expect(nextRef(bg, '1/16-18')).toBe('1/19');
    expect(nextRef(bg, '1/46')).toBe('2/1');
    expect(previousRef(bg, '2/1')).toBe('1/46');
    expect(nextRef(bg, '18/78')).toBeNull();
    expect(versesInRef('1/16-18')).toBe(3);
    expect(versesInRef('2/13')).toBe(1);
  });

  it('crosses canto and lila boundaries in three-level books', async () => {
    const sb = await loadVerseIndex('sb');
    expect(firstRef(sb)).toBe('1/1/1');
    const lastOfCanto1 = flattenIndex(sb).filter((r) => r.startsWith('1/')).pop()!;
    expect(nextRef(sb, lastOfCanto1)).toBe('2/1/1');

    const cc = await loadVerseIndex('cc');
    expect(firstRef(cc)).toBe('adi/1/1');
    const lastAdi = flattenIndex(cc).filter((r) => r.startsWith('adi/')).pop()!;
    expect(nextRef(cc, lastAdi)).toBe('madhya/1/1');
  });

  it('resolves typed references, including a verse inside a combined page', async () => {
    const bg = await loadVerseIndex('bg');
    expect(resolveRef(bg, 'bg', 'Bg 2.13')).toBe('2/13');
    expect(resolveRef(bg, 'bg', '2.13')).toBe('2/13');
    expect(resolveRef(bg, 'bg', '1.17')).toBe('1/16-18');
    expect(resolveRef(bg, 'bg', '19.1')).toBeNull();
    expect(resolveRef(bg, 'bg', 'hello')).toBeNull();

    const cc = await loadVerseIndex('cc');
    expect(resolveRef(cc, 'cc', 'CC Adi 1.1')).toBe('adi/1/1');

    const iso = await loadVerseIndex('iso');
    expect(resolveRef(iso, 'iso', 'Iso 5')).toBe('5');
  });

  it('formats references and Vedabase URLs', () => {
    expect(formatRef('bg', '2/13')).toBe('Bg 2.13');
    expect(formatRef('cc', 'adi/1/1')).toBe('CC Adi 1.1');
    expect(formatRefRange('bg', '2/13', '2/15')).toBe('Bg 2.13 – 2.15');
    expect(formatRefRange('sb', '1/2/6', '1/2/6')).toBe('SB 1.2.6');
    expect(vedabaseUrl('sb', '1/2/6')).toBe('https://vedabase.io/en/library/sb/1/2/6/');
  });

  it('has a non-empty verse index for every book in the reading log', async () => {
    for (const book of READER_BOOKS) {
      expect(bookCodeForTitle(book.title)).toBe(book.code);
      const idx = await loadVerseIndex(book.code);
      expect(flattenIndex(idx).length).toBeGreaterThan(0);
    }
  });
});
