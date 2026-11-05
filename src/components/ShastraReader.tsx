import { useEffect, useMemo, useRef, useState } from 'react';
import {
  READER_BOOKS,
  firstRef,
  flattenIndex,
  formatRef,
  formatRefRange,
  getReaderBook,
  loadVerseIndex,
  nextRef,
  previousRef,
  resolveRef,
  vedabaseUrl,
  versesInRef,
  type BookCode,
  type ReaderProgress,
  type VerseIndex,
} from '../reader/vedabase';

export interface FinishedReading {
  book: string;
  reference: string;
  verses: number;
  minutes: number;
  note: string;
}

interface ShastraReaderProps {
  initialBook: BookCode;
  progress: ReaderProgress;
  onProgressChange: (next: ReaderProgress) => void;
  onFinish: (reading: FinishedReading) => void;
  onClose: () => void;
}

type Phase = 'setup' | 'read' | 'recall' | 'done';

interface CompletedPage {
  ref: string;
  recall: string;
}

/** Seconds spent reading, counted only while this tab is in front of you. */
function useActiveSeconds(running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return seconds;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ShastraReader({
  initialBook,
  progress,
  onProgressChange,
  onFinish,
  onClose,
}: ShastraReaderProps) {
  const [bookCode, setBookCode] = useState<BookCode>(initialBook);
  const [index, setIndex] = useState<VerseIndex | null>(null);
  const [indexError, setIndexError] = useState(false);
  const [phase, setPhase] = useState<Phase>('setup');
  const [currentRef, setCurrentRef] = useState<string>('');
  const [jumpText, setJumpText] = useState('');
  const [jumpError, setJumpError] = useState('');
  const [recallText, setRecallText] = useState('');
  const [completed, setCompleted] = useState<CompletedPage[]>([]);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [summary, setSummary] = useState<FinishedReading | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const recallRef = useRef<HTMLTextAreaElement>(null);
  const finishedRef = useRef(false);

  const book = getReaderBook(bookCode);
  const bookProgress = progress[bookCode];
  const seconds = useActiveSeconds(phase === 'read' || phase === 'recall');
  const versesDone = useMemo(
    () => completed.reduce((acc, page) => acc + versesInRef(page.ref), 0),
    [completed]
  );

  // Load the verse-number index for the chosen book and set the resume point.
  useEffect(() => {
    let cancelled = false;
    setIndex(null);
    setIndexError(false);
    loadVerseIndex(bookCode)
      .then((idx) => {
        if (cancelled) return;
        setIndex(idx);
        const saved = progress[bookCode]?.nextRef;
        const start = saved && flattenIndex(idx).includes(saved) ? saved : firstRef(idx);
        setCurrentRef(start);
        setJumpText(formatRef(bookCode, start));
        setJumpError('');
      })
      .catch(() => {
        if (!cancelled) setIndexError(true);
      });
    return () => {
      cancelled = true;
    };
    // progress is read once per book switch on purpose: stepping through verses updates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookCode]);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase === 'recall') recallRef.current?.focus();
  }, [phase]);

  function saveProgress(patch: Partial<NonNullable<ReaderProgress[BookCode]>>) {
    const prev = progress[bookCode];
    onProgressChange({
      ...progress,
      [bookCode]: {
        nextRef: prev?.nextRef ?? currentRef,
        ...prev,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  function handleStart() {
    if (!index) return;
    const typed = jumpText.trim();
    const resolved = typed ? resolveRef(index, bookCode, typed) : currentRef;
    if (!resolved) {
      setJumpError(`Couldn't find “${typed}” in ${book.title}. Try a form like ${formatRef(bookCode, firstRef(index))}.`);
      return;
    }
    setJumpError('');
    setCurrentRef(resolved);
    setFrameLoaded(false);
    setPhase('read');
  }

  function goTo(ref: string) {
    setCurrentRef(ref);
    setFrameLoaded(false);
    setRecallText('');
    setPhase('read');
  }

  function buildReading(pages: CompletedPage[]): FinishedReading | null {
    if (pages.length === 0) return null;
    const recalls = pages.map((p) => p.recall.trim()).filter(Boolean);
    return {
      book: book.title,
      reference: formatRefRange(bookCode, pages[0].ref, pages[pages.length - 1].ref),
      verses: pages.reduce((acc, p) => acc + versesInRef(p.ref), 0),
      minutes: Math.max(1, Math.round(seconds / 60)),
      note: recalls.length > 0 ? recalls.join(' · ') : 'Read in the app.',
    };
  }

  /** Record the verse on screen as read, with whatever recall was written. */
  function completeCurrent(): CompletedPage[] {
    if (!index) return completed;
    const page = { ref: currentRef, recall: recallText.trim() };
    const pages = [...completed, page];
    setCompleted(pages);
    const upcoming = nextRef(index, currentRef);
    saveProgress({
      nextRef: upcoming ?? currentRef,
      lastRef: currentRef,
      lastRecall: page.recall || bookProgress?.lastRecall,
    });
    return pages;
  }

  function handleNextVerse() {
    if (!index) return;
    completeCurrent();
    const upcoming = nextRef(index, currentRef);
    if (upcoming) {
      goTo(upcoming);
    } else {
      finish([...completed, { ref: currentRef, recall: recallText.trim() }]);
    }
  }

  function finish(pages: CompletedPage[]) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const reading = buildReading(pages);
    if (reading) onFinish(reading);
    setSummary(reading);
    setPhase('done');
  }

  function handleFinishFromRecall() {
    finish(completeCurrent());
  }

  /** Leaving never throws away verses already finished: they are logged on the way out. */
  function handleClose() {
    if (phase !== 'done' && completed.length > 0) {
      finish(completed);
    }
    onClose();
  }

  // Escape closes (and logs anything already finished).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const prev = index && currentRef ? previousRef(index, currentRef) : null;
  const goalMet = versesDone >= 1;

  return (
    <div
      className="reader-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Read ${book.title}`}
      ref={dialogRef}
    >
      <header className="reader-topbar">
        <div className="reader-topbar-left">
          <span className="reader-book">{book.title}</span>
          {phase !== 'setup' && phase !== 'done' && currentRef && (
            <span className="reader-ref">{formatRef(bookCode, currentRef)}</span>
          )}
        </div>
        <div className="reader-topbar-right">
          {phase !== 'setup' && phase !== 'done' && (
            <>
              <span className="reader-stat" aria-label="Time reading">
                {formatClock(seconds)}
              </span>
              <span className={`reader-stat${goalMet ? ' is-met' : ''}`}>
                {goalMet ? `✓ ${versesDone} verse${versesDone === 1 ? '' : 's'}` : 'Goal: 1 verse'}
              </span>
            </>
          )}
          <button type="button" className="btn-secondary-pill" onClick={handleClose}>
            {phase === 'done' ? 'Close' : completed.length > 0 ? 'Finish & close' : 'Close'}
          </button>
        </div>
      </header>

      {phase === 'setup' && (
        <div className="reader-setup">
          <h2 className="reader-setup-title">Just one verse.</h2>
          <p className="reader-setup-sub">
            Read one verse, then say it back in a sentence. Anything more is a bonus.
          </p>

          <div className="reader-book-chips" role="radiogroup" aria-label="Book">
            {READER_BOOKS.map((b) => (
              <button
                key={b.code}
                type="button"
                role="radio"
                aria-checked={b.code === bookCode}
                className={`reader-chip${b.code === bookCode ? ' is-active' : ''}`}
                onClick={() => setBookCode(b.code)}
              >
                {b.title}
              </button>
            ))}
          </div>

          {bookProgress?.lastRef && (
            <div className="reader-warmup">
              <span className="reader-warmup-label">
                Last time · {formatRef(bookCode, bookProgress.lastRef)}
              </span>
              <p className="reader-warmup-text">
                {bookProgress.lastRecall
                  ? `“${bookProgress.lastRecall}”`
                  : 'No recall written. Can you remember what it said?'}
              </p>
            </div>
          )}

          <form
            className="reader-start-row"
            onSubmit={(e) => {
              e.preventDefault();
              handleStart();
            }}
          >
            <div className="field-group" style={{ flex: 1 }}>
              <label className="field-label" htmlFor="reader-start-ref">
                {bookProgress ? 'Pick up at' : 'Start at'}
              </label>
              <input
                id="reader-start-ref"
                className="field-input"
                value={jumpText}
                onChange={(e) => setJumpText(e.target.value)}
                disabled={!index}
                aria-invalid={jumpError ? true : undefined}
                aria-describedby={jumpError ? 'reader-start-error' : undefined}
              />
            </div>
            <button
              type="submit"
              className="btn-primary-pill"
              disabled={!index}
              data-autofocus
            >
              Start reading
            </button>
          </form>
          {jumpError && (
            <p id="reader-start-error" className="reader-error" role="alert">
              {jumpError}
            </p>
          )}
          {indexError && (
            <p className="reader-error" role="alert">
              Couldn't load the verse list for this book. Check your connection and try again.
            </p>
          )}
          <p className="reader-credit">
            Verses open from Vedabase. Text © The Bhaktivedanta Book Trust International; nothing is copied into this app.
          </p>
        </div>
      )}

      {(phase === 'read' || phase === 'recall') && (
        <div className="reader-stage">
          <div className={`reader-frame-wrap${phase === 'recall' ? ' is-covered' : ''}`}>
            {!frameLoaded && <div className="reader-frame-loading">Opening {formatRef(bookCode, currentRef)}…</div>}
            <iframe
              key={currentRef}
              className="reader-frame"
              src={vedabaseUrl(bookCode, currentRef)}
              title={`${formatRef(bookCode, currentRef)} on Vedabase`}
              onLoad={() => setFrameLoaded(true)}
              aria-hidden={phase === 'recall' ? true : undefined}
              tabIndex={phase === 'recall' ? -1 : undefined}
            />
          </div>

          {phase === 'read' && (
            <div className="reader-actionbar">
              <div className="reader-actionbar-left">
                <button
                  type="button"
                  className="btn-secondary-pill"
                  disabled={!prev}
                  onClick={() => prev && goTo(prev)}
                >
                  ← Previous
                </button>
                <a
                  className="reader-link"
                  href={vedabaseUrl(bookCode, currentRef)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open on Vedabase ↗
                </a>
              </div>
              <button
                type="button"
                className="btn-primary-pill"
                onClick={() => setPhase('recall')}
                data-autofocus
              >
                I've read it →
              </button>
            </div>
          )}

          {phase === 'recall' && (
            <div className="reader-recall">
              <label className="reader-recall-label" htmlFor="reader-recall-input">
                Without looking back: what did {formatRef(bookCode, currentRef)} say? One sentence.
              </label>
              <textarea
                id="reader-recall-input"
                ref={recallRef}
                className="field-textarea"
                value={recallText}
                onChange={(e) => setRecallText(e.target.value)}
                placeholder="In my own words…"
                rows={3}
              />
              <div className="reader-actionbar reader-actionbar--flush">
                <button type="button" className="btn-secondary-pill" onClick={() => setPhase('read')}>
                  Peek again
                </button>
                <div className="reader-actionbar-right">
                  <button type="button" className="btn-secondary-pill" onClick={handleFinishFromRecall}>
                    Finish &amp; log
                  </button>
                  <button type="button" className="btn-primary-pill" onClick={handleNextVerse}>
                    Next verse →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="reader-setup">
          {summary ? (
            <>
              <h2 className="reader-setup-title">Logged. Haribol!</h2>
              <p className="reader-setup-sub">
                {summary.reference} · {summary.verses} verse{summary.verses === 1 ? '' : 's'} ·{' '}
                {summary.minutes} min
              </p>
              {bookProgress?.nextRef && (
                <p className="reader-setup-sub">
                  Next time you'll pick up at {formatRef(bookCode, bookProgress.nextRef)}.
                </p>
              )}
            </>
          ) : (
            <h2 className="reader-setup-title">Nothing logged this time.</h2>
          )}
          <div>
            <button type="button" className="btn-primary-pill" onClick={onClose} data-autofocus>
              Back to today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
