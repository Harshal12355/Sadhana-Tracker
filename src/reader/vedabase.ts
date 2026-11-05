/**
 * Verse navigation for the in-app Shastra reader.
 *
 * The scripture text itself is never copied into the app: each verse opens from vedabase.io,
 * which shows it under BBT permission. The app only keeps verse *numbers* (src/reader/index,
 * built by scripts/build_vedabase_index.py) so it can step to the next readable page,
 * including combined verses such as Bg 1.16-18.
 */

export type BookCode = 'bg' | 'sb' | 'cc' | 'nod' | 'noi' | 'iso' | 'spl';

export interface ReaderBook {
  code: BookCode;
  /** Must match the titles in the reading log's book list. */
  title: string;
  /** Short label used in references, e.g. "Bg 2.13". */
  abbrev: string;
}

export const READER_BOOKS: ReaderBook[] = [
  { code: 'bg', title: 'Bhagavad-gita As It Is', abbrev: 'Bg' },
  { code: 'sb', title: 'Srimad-Bhagavatam', abbrev: 'SB' },
  { code: 'cc', title: 'Sri Caitanya-caritamrta', abbrev: 'CC' },
  { code: 'nod', title: 'Nectar of Devotion', abbrev: 'NOD' },
  { code: 'noi', title: 'Nectar of Instruction (Upadesamrta)', abbrev: 'NOI' },
  { code: 'iso', title: 'Sri Isopanisad', abbrev: 'Iso' },
  { code: 'spl', title: 'Prabhupada Lilamrta', abbrev: 'SPL' },
];

/** Parent path (relative to the book, "" for one-level books) -> ordered readable slugs. */
export type VerseIndex = Record<string, string[]>;

const indexLoaders: Record<BookCode, () => Promise<{ default: VerseIndex }>> = {
  bg: () => import('./index/bg.json'),
  sb: () => import('./index/sb.json'),
  cc: () => import('./index/cc.json'),
  nod: () => import('./index/nod.json'),
  noi: () => import('./index/noi.json'),
  iso: () => import('./index/iso.json'),
  spl: () => import('./index/spl.json'),
};

const indexCache = new Map<BookCode, VerseIndex>();

export async function loadVerseIndex(code: BookCode): Promise<VerseIndex> {
  const cached = indexCache.get(code);
  if (cached) return cached;
  const mod = await indexLoaders[code]();
  indexCache.set(code, mod.default);
  return mod.default;
}

export function getReaderBook(code: BookCode): ReaderBook {
  return READER_BOOKS.find((b) => b.code === code) ?? READER_BOOKS[0];
}

export function bookCodeForTitle(title: string): BookCode | null {
  return READER_BOOKS.find((b) => b.title === title)?.code ?? null;
}

/** Every readable page of a book, in reading order, as refs like "2/13" or "adi/1/1". */
export function flattenIndex(index: VerseIndex): string[] {
  const refs: string[] = [];
  for (const [parent, slugs] of Object.entries(index)) {
    for (const slug of slugs) refs.push(parent ? `${parent}/${slug}` : slug);
  }
  return refs;
}

/** Index files keep insertion order (canto/chapter order), so a flat list is reading order. */
export function firstRef(index: VerseIndex): string {
  return flattenIndex(index)[0] ?? '1';
}

/** Next readable page after `ref`, or null at the end of the book. */
export function nextRef(index: VerseIndex, ref: string): string | null {
  const refs = flattenIndex(index);
  const at = refs.indexOf(ref);
  if (at === -1) return null;
  return refs[at + 1] ?? null;
}

export function previousRef(index: VerseIndex, ref: string): string | null {
  const refs = flattenIndex(index);
  const at = refs.indexOf(ref);
  return at > 0 ? refs[at - 1] : null;
}

/**
 * Turn what someone types ("2.13", "Bg 2.16", "adi 1.1", "SB 1.2.6") into a known ref.
 * A verse inside a combined page (Bg 1.17) resolves to that page (1/16-18).
 */
export function resolveRef(index: VerseIndex, code: BookCode, input: string): string | null {
  const book = getReaderBook(code);
  let text = input.trim().toLowerCase();
  const prefix = book.abbrev.toLowerCase();
  if (text.startsWith(prefix)) text = text.slice(prefix.length);
  const parts = text
    .replace(/^[\s.:]+/, '')
    .split(/[\s./:]+/)
    .filter(Boolean);
  if (parts.length === 0) return null;
  const parentKey = parts.slice(0, -1).join('/');
  const slugs = index[parentKey];
  if (!slugs) return null;
  const want = parts[parts.length - 1];
  if (slugs.includes(want)) return parentKey ? `${parentKey}/${want}` : want;
  const n = Number(want);
  if (!Number.isInteger(n)) return null;
  const match = slugs.find((slug) => {
    const [lo, hi] = slug.split('-').map(Number);
    return n >= lo && n <= (hi ?? lo);
  });
  if (!match) return null;
  return parentKey ? `${parentKey}/${match}` : match;
}

export function vedabaseUrl(code: BookCode, ref: string): string {
  return `https://vedabase.io/en/library/${code}/${ref}/`;
}

/** "2/13" -> "Bg 2.13"; "adi/1/1" -> "CC Adi 1.1". */
export function formatRef(code: BookCode, ref: string): string {
  const book = getReaderBook(code);
  const parts = ref.split('/');
  if (code === 'cc' && parts.length > 0) {
    const lila = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return `${book.abbrev} ${lila} ${parts.slice(1).join('.')}`.trim();
  }
  return `${book.abbrev} ${parts.join('.')}`;
}

/** Number of verses a page covers: "16-18" is 3. */
export function versesInRef(ref: string): number {
  const last = ref.split('/').pop() ?? '';
  const [lo, hi] = last.split('-').map(Number);
  if (!Number.isFinite(lo)) return 1;
  return Number.isFinite(hi) && hi >= lo ? hi - lo + 1 : 1;
}

/** "Bg 2.13" for one page, "Bg 2.13 – 2.15" for a run. */
export function formatRefRange(code: BookCode, startRef: string, endRef: string): string {
  if (startRef === endRef) return formatRef(code, startRef);
  const end = formatRef(code, endRef).replace(`${getReaderBook(code).abbrev} `, '');
  return `${formatRef(code, startRef)} – ${end}`;
}

/* ---------- Per-book bookmark (where to resume) ---------- */

export const READER_PROGRESS_KEY = 'sadhana_valli_reader_v1';

export interface BookProgress {
  /** The page to open next time. */
  nextRef: string;
  /** What was last finished, and the recall written for it, shown as tomorrow's warm-up. */
  lastRef?: string;
  lastRecall?: string;
  updatedAt?: string;
}

export type ReaderProgress = Partial<Record<BookCode, BookProgress>>;

export function loadReaderProgress(): ReaderProgress {
  try {
    const raw = localStorage.getItem(READER_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as ReaderProgress) : {};
  } catch {
    return {};
  }
}

export function saveReaderProgress(progress: ReaderProgress): void {
  try {
    localStorage.setItem(READER_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be unavailable (private mode); the reader still works for this session.
  }
}
