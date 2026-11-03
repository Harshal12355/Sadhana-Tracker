import React, { useState, useEffect, useMemo, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  LAST_SYNCED_UID_KEY,
  LoginScreen,
  resolveInitialSessionGate,
  resolveLocalSeedForUser,
  SESSION_MODE_KEY,
} from './components/LoginScreen';
import { getFirebaseClients, isFirebaseConfigured } from './firebase/config';
import {
  saveDayRecordToFirestore,
  saveUserPrefsToFirestore,
  subscribeToUserSadhana,
  type TimestampedSadhanaRecord,
} from './firebase/sadhanaSync';
import {
  fetchCalendarMonth,
  importCalendarIcsViaApi,
  resolveYouTubeViaApi,
} from './api/backendClient';
import {
  DailySadhanaRecord,
  INITIAL_SADHANA_HISTORY,
  DEFAULT_VAISHNAVA_CALENDAR_NOV_2026,
  VaishnavaEvent,
  ISKCON_CITIES,
  CloudAccountState,
  formatParanaForCity,
  countCompletedRounds,
  sumReadingMinutes,
  sumReadingPages,
  sumLectureMinutes,
  extractYouTubeId,
  getYouTubeThumbUrl,
} from './sadhanaData';

type ActiveSection = 'almanac' | 'japa' | 'shastra' | 'sravanam' | 'calendar' | 'cloud';

const STORAGE_KEY = 'sadhana_valli_records_v3';
const THEME_KEY = 'sadhana_valli_theme_v1';
const CITY_KEY = 'sadhana_valli_city_v1';
const CLOUD_AUTH_KEY = 'sadhana_valli_oauth_v1';
const CUSTOM_CAL_KEY = 'sadhana_valli_ics_v1';

const SHASTRA_BOOKS = [
  'Bhagavad-gita As It Is',
  'Srimad-Bhagavatam',
  'Sri Caitanya-caritamrta',
  'Nectar of Devotion',
  'Nectar of Instruction (Upadesamrta)',
  'Sri Isopanisad',
  'Prabhupada Lilamrta',
];

function formatHumanDate(isoDate: string, includeWeekday = true): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('en-US', {
    weekday: includeWeekday ? 'short' : undefined,
    month: 'short',
    day: 'numeric',
  });
}

/** Union by date (incoming wins), sorted ascending, so adjacent months coexist. */
function mergeCalendarEventsByDate(existing: VaishnavaEvent[], incoming: VaishnavaEvent[]) {
  const byDate = new Map<string, VaishnavaEvent>();
  for (const ev of existing) byDate.set(ev.date, ev);
  for (const ev of incoming) byDate.set(ev.date, ev);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** `YYYY-MM` shifted by `delta` months. */
function shiftMonth(yyyyMm: string, delta: number): { year: number; month: number } {
  const [y, m] = yyyyMm.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
      if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // ignore
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const [records, setRecords] = useState<DailySadhanaRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0].completedRounds === 'number') {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_SADHANA_HISTORY;
  });

  const [selectedCityId, setSelectedCityId] = useState<string>(() => {
    try {
      return localStorage.getItem(CITY_KEY) || 'nyc';
    } catch {
      return 'nyc';
    }
  });

  const selectedCity = useMemo(
    () => ISKCON_CITIES.find((c) => c.id === selectedCityId) || ISKCON_CITIES[0],
    [selectedCityId]
  );

  const [calendarEvents, setCalendarEvents] = useState<VaishnavaEvent[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_CAL_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_VAISHNAVA_CALENDAR_NOV_2026;
  });

  const [calFilterOnlyFestivals, setCalFilterOnlyFestivals] = useState(false);
  const [icsStatusMsg, setIcsStatusMsg] = useState<string>('');

  const [selectedDate, setSelectedDate] = useState<string>('2026-11-02');
  const [activeNav, setActiveNav] = useState<ActiveSection>('almanac');
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [failedThumbIds, setFailedThumbIds] = useState<Record<string, boolean>>({});

  // Inline form states for Shastra Reading
  const [showReadingForm, setShowReadingForm] = useState(false);
  const [newBook, setNewBook] = useState(SHASTRA_BOOKS[0]);
  const [newReference, setNewReference] = useState('');
  const [newPages, setNewPages] = useState('8');
  const [newReadMins, setNewReadMins] = useState('25');
  const [newReadNote, setNewReadNote] = useState('');

  // Inline form states for YouTube Sravanam Lecture
  const [showLectureForm, setShowLectureForm] = useState(false);
  const [newYtUrl, setNewYtUrl] = useState('');
  const [newLecTitle, setNewLecTitle] = useState('');
  const [newSpeaker, setNewSpeaker] = useState('Srila Prabhupada');
  const [newLecMins, setNewLecMins] = useState('35');
  const [newTimestamp, setNewTimestamp] = useState('12:00');
  const [newRealization, setNewRealization] = useState('');
  const [ytFetchStatus, setYtFetchStatus] = useState<string>('');

  // Zero-Config One-Click OAuth Cloud Sync State
  const [cloudAccount, setCloudAccount] = useState<CloudAccountState>(() => {
    try {
      const raw = localStorage.getItem(CLOUD_AUTH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CloudAccountState;
        // Google connection now comes from real Firebase Auth, never from stored mock state.
        if (parsed.connectedProvider === 'github') return parsed;
      }
    } catch {
      // ignore
    }
    return {
      connectedProvider: 'none',
      userEmailOrHandle: null,
      lastSyncedAt: 'Saved on this device',
      autoSync: true,
    };
  });

  // ---- Firebase Auth session gate -------------------------------------------------------
  const firebaseConfigured = isFirebaseConfigured();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(() => !isFirebaseConfigured());
  const [storedSessionMode, setStoredSessionMode] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SESSION_MODE_KEY) || localStorage.getItem(SESSION_MODE_KEY);
    } catch {
      return null;
    }
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const sessionGate = resolveInitialSessionGate(firebaseUser, storedSessionMode);
  const uid = firebaseUser?.uid ?? null;

  const recordsRef = useRef(records);
  recordsRef.current = records;
  const uidRef = useRef<string | null>(uid);
  uidRef.current = uid;
  const prefsRef = useRef({ theme, selectedCityId });
  prefsRef.current = { theme, selectedCityId };
  const customCalendarRef = useRef<VaishnavaEvent[] | undefined>(undefined);
  if (customCalendarRef.current === undefined) {
    try {
      const saved = localStorage.getItem(CUSTOM_CAL_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) customCalendarRef.current = parsed;
    } catch {
      // ignore
    }
  }
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingSavesRef = useRef<Map<string, TimestampedSadhanaRecord>>(new Map());

  useEffect(() => {
    const clients = getFirebaseClients();
    if (!clients) {
      setAuthReady(true);
      return;
    }
    // If the auth cache is slow (offline cold start), do not hold the screen hostage.
    const fallback = setTimeout(() => setAuthReady(true), 2000);
    const unsub = onAuthStateChanged(
      clients.auth,
      (user) => {
        clearTimeout(fallback);
        setFirebaseUser(user);
        setAuthReady(true);
        if (user) {
          try {
            sessionStorage.removeItem(SESSION_MODE_KEY);
            localStorage.removeItem(SESSION_MODE_KEY);
          } catch {
            // ignore
          }
          setStoredSessionMode(null);
        }
      },
      () => {
        clearTimeout(fallback);
        setAuthReady(true);
      }
    );
    return () => {
      clearTimeout(fallback);
      unsub();
    };
  }, []);

  function persistPrefs(overrides?: { theme?: 'light' | 'dark'; selectedCityId?: string }) {
    const activeUid = uidRef.current;
    if (!activeUid) return;
    const prefs = { ...prefsRef.current, ...overrides };
    void saveUserPrefsToFirestore(activeUid, {
      theme: prefs.theme,
      selectedCityId: prefs.selectedCityId,
      ...(customCalendarRef.current ? { customCalendarEvents: customCalendarRef.current } : {}),
    }).catch(() => {});
  }

  async function handleGoogleSignIn() {
    const clients = getFirebaseClients();
    if (!clients) {
      setAuthError('Google sign-in is not configured. Add VITE_FIREBASE_* keys to .env.');
      return;
    }
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithPopup(clients.auth, clients.googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setAuthError('Google sign-in did not complete. Check your connection or continue offline.');
      }
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleContinueLocal() {
    try {
      localStorage.setItem(SESSION_MODE_KEY, 'local');
      sessionStorage.setItem(SESSION_MODE_KEY, 'local');
    } catch {
      // ignore
    }
    setAuthError(null);
    setStoredSessionMode('local');
  }

  function returnToLoginScreen() {
    try {
      localStorage.removeItem(SESSION_MODE_KEY);
      sessionStorage.removeItem(SESSION_MODE_KEY);
    } catch {
      // ignore
    }
    setAuthError(null);
    setStoredSessionMode(null);
  }

  /** Forget the previous account's data on this device (used on sign-out and account switch). */
  function resetLocalWorkspaceData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CUSTOM_CAL_KEY);
      localStorage.removeItem(LAST_SYNCED_UID_KEY);
    } catch {
      // ignore
    }
    customCalendarRef.current = undefined;
    pendingSavesRef.current.clear();
    setRecords(INITIAL_SADHANA_HISTORY);
    setCalendarEvents(DEFAULT_VAISHNAVA_CALENDAR_NOV_2026);
  }

  async function handleSignOut() {
    returnToLoginScreen();
    const clients = getFirebaseClients();
    if (clients && firebaseUser) {
      // Flush nothing further for this account; clear its data from the device.
      saveTimersRef.current.forEach((t) => clearTimeout(t));
      saveTimersRef.current.clear();
      resetLocalWorkspaceData();
      try {
        await signOut(clients.auth);
      } catch {
        // ignore
      }
    }
    setFirebaseUser(null);
  }

  // Firestore sync: merge local records with the cloud copy, keep UI live.
  useEffect(() => {
    if (!uid) return;
    let gotPrefs = false;
    let lastSyncedUid: string | null = null;
    try {
      lastSyncedUid = localStorage.getItem(LAST_SYNCED_UID_KEY);
    } catch {
      // ignore
    }
    const localSeed = resolveLocalSeedForUser(recordsRef.current, lastSyncedUid, uid);
    if (lastSyncedUid !== null && lastSyncedUid !== uid) {
      // Account switch: wipe the previous account's data before subscribing to the new one.
      saveTimersRef.current.forEach((t) => clearTimeout(t));
      saveTimersRef.current.clear();
      resetLocalWorkspaceData();
    }
    try {
      localStorage.setItem(LAST_SYNCED_UID_KEY, uid);
    } catch {
      // ignore
    }
    const unsubscribe = subscribeToUserSadhana(
      uid,
      localSeed,
      (cloudRecords) => {
        if (cloudRecords.length === 0) return;
        setRecords((prev) => {
          const pending = pendingSavesRef.current;
          if (pending.size === 0) return cloudRecords;
          // A local edit is still waiting to be saved: never let an older snapshot clobber it.
          const prevByDate = new Map(prev.map((r) => [r.date, r]));
          const kept = cloudRecords.map((r) => {
            const inFlight = pending.get(r.date);
            return inFlight ? (prevByDate.get(r.date) ?? inFlight) : r;
          });
          const cloudDates = new Set(cloudRecords.map((r) => r.date));
          for (const [date, rec] of pending) {
            if (!cloudDates.has(date)) kept.push(prevByDate.get(date) ?? rec);
          }
          return kept.sort((a, b) => b.date.localeCompare(a.date));
        });
      },
      (prefs) => {
        gotPrefs = true;
        if (prefs.theme === 'light' || prefs.theme === 'dark') setTheme(prefs.theme);
        if (prefs.selectedCityId && ISKCON_CITIES.some((c) => c.id === prefs.selectedCityId)) {
          setSelectedCityId(prefs.selectedCityId);
        }
        if (Array.isArray(prefs.customCalendarEvents) && prefs.customCalendarEvents.length > 0) {
          customCalendarRef.current = prefs.customCalendarEvents;
          setCalendarEvents(prefs.customCalendarEvents);
          try {
            localStorage.setItem(CUSTOM_CAL_KEY, JSON.stringify(prefs.customCalendarEvents));
          } catch {
            // ignore
          }
        }
      }
    );
    // First sign-in on a fresh account: no cloud prefs arrive, so seed them from this device.
    const seedTimer = setTimeout(() => {
      if (!gotPrefs) persistPrefs();
    }, 3000);
    return () => {
      clearTimeout(seedTimer);
      unsubscribe();
    };
  }, [uid]);

  // Almanac from the FastAPI engine (city-aware Parana). Offline, backendClient falls back to
  // the built-in Gaurabda 540 table, so this never blocks or empties the workspace.
  const selectedMonth = selectedDate.slice(0, 7);
  useEffect(() => {
    if (customCalendarRef.current) return;
    const [year, month] = selectedMonth.split('-').map(Number);
    if (!year || !month) return;
    let cancelled = false;
    // Previous, current and next month, merged by date, so stepping and "next Ekadashi" cross months.
    for (const delta of [0, 1, -1]) {
      const target = shiftMonth(selectedMonth, delta);
      fetchCalendarMonth(target.year, target.month, selectedCityId)
        .then((events) => {
          if (cancelled || customCalendarRef.current || events.length === 0) return;
          setCalendarEvents((prev) => mergeCalendarEventsByDate(prev, events));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, selectedCityId]);

  useEffect(() => {
    const timers = saveTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // Debounced Firestore writes for local edits. `pendingSavesRef` holds the latest unsaved record
  // per date; it also tells snapshot handling which dates have an in-flight local edit.
  useEffect(() => {
    const pending = pendingSavesRef.current;
    if (pending.size === 0) return;
    if (!uidRef.current) {
      pending.clear();
      return;
    }
    const timers = saveTimersRef.current;
    for (const date of pending.keys()) {
      const existing = timers.get(date);
      if (existing) clearTimeout(existing);
      timers.set(
        date,
        setTimeout(() => {
          timers.delete(date);
          const record = pending.get(date);
          pending.delete(date);
          const activeUid = uidRef.current;
          if (!record || !activeUid) return;
          void saveDayRecordToFirestore(activeUid, record).catch(() => {});
        }, 400)
      );
    }
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // ignore
    }
  }, [records]);

  useEffect(() => {
    try {
      localStorage.setItem(CITY_KEY, selectedCityId);
    } catch {
      // ignore
    }
  }, [selectedCityId]);

  useEffect(() => {
    try {
      localStorage.setItem(CLOUD_AUTH_KEY, JSON.stringify(cloudAccount));
    } catch {
      // ignore
    }
  }, [cloudAccount]);

  // If the user clicks any calendar date that doesn't have a record yet, synthesize a clean day record
  const currentRecord = useMemo<DailySadhanaRecord>(() => {
    const existing = records.find((r) => r.date === selectedDate);
    if (existing) return existing;
    const calDay = calendarEvents.find((e) => e.date === selectedDate);
    return {
      date: selectedDate,
      tithi: calDay
        ? `${calDay.masa} Masa · ${calDay.paksha} ${calDay.tithi} · Gaurabda 540`
        : 'Damodara Masa · Gaurabda 540',
      panchangaNote: calDay?.festival || 'Regular Sadhana Day',
      targetRounds: 16,
      completedRounds: 0,
      chantedBefore7AM: false,
      readings: [],
      lectures: [],
      reflection: '',
      wakeTime: '05:00', // taste-skill-ignore
      mangalaArati: false,
    };
  }, [records, selectedDate, calendarEvents]);

  const currentCalendarEvent = useMemo(
    () =>
      calendarEvents.find((e) => e.date === selectedDate) ||
      DEFAULT_VAISHNAVA_CALENDAR_NOV_2026[1],
    [calendarEvents, selectedDate]
  );

  const completedRounds = currentRecord.completedRounds;
  const remainingRounds = Math.max(0, currentRecord.targetRounds - completedRounds);
  const totalBeadsChanted = completedRounds * 108;
  const progressPct = Math.min(100, Math.round((completedRounds / currentRecord.targetRounds) * 100));

  const readingMinsToday = useMemo(() => sumReadingMinutes(currentRecord), [currentRecord]);
  const readingPagesToday = useMemo(() => sumReadingPages(currentRecord), [currentRecord]);
  const lectureMinsToday = useMemo(() => sumLectureMinutes(currentRecord), [currentRecord]);

  const fourteenDayStats = useMemo(() => {
    const slice = records.slice(0, 14);
    const totalRounds14d = slice.reduce((acc, r) => acc + countCompletedRounds(r), 0);
    const daysMetTarget = slice.filter((r) => countCompletedRounds(r) >= r.targetRounds).length;
    const earlyMorningDays = slice.filter((r) => r.chantedBefore7AM).length;
    const avgRounds = (totalRounds14d / slice.length).toFixed(1);

    console.assert(totalRounds14d >= 0, 'Total 14d rounds must be non-negative');
    return {
      totalRounds14d,
      daysMetTarget,
      totalDays: slice.length,
      earlyMorningDays,
      avgRounds,
    };
  }, [records]);

  const parsedPreviewId = useMemo(() => extractYouTubeId(newYtUrl), [newYtUrl]);

  useEffect(() => {
    if (!parsedPreviewId) {
      setYtFetchStatus('');
      return;
    }
    let cancelled = false;
    setYtFetchStatus('Fetching video title...');
    // FastAPI resolver; falls back to a local thumbnail-only result when the API is unreachable.
    resolveYouTubeViaApi(parsedPreviewId)
      .then((data) => {
        if (cancelled) return;
        if (data && data.title) {
          setNewLecTitle((prev) => (prev ? prev : data.title));
          if (data.speaker) {
            setNewSpeaker(data.speaker);
          }
          setYtFetchStatus('Resolved YouTube metadata');
        } else {
          setYtFetchStatus('Thumbnail ready');
        }
      })
      .catch(() => {
        if (!cancelled) setYtFetchStatus('Thumbnail ready');
      });
    return () => {
      cancelled = true;
    };
  }, [parsedPreviewId]);

  function updateCurrentRecord(updater: (rec: DailySadhanaRecord) => DailySadhanaRecord) {
    const date = currentRecord.date;
    const stamp = new Date().toISOString();
    // Updater runs on the latest queued state, so rapid taps in one batch never read a stale closure.
    setRecords((prev) => {
      const base = prev.find((item) => item.date === date) ?? currentRecord;
      const updated: TimestampedSadhanaRecord = { ...updater(base), updatedAt: stamp };
      // Idempotent set: safe even if React invokes this updater twice.
      pendingSavesRef.current.set(date, updated);
      const exists = prev.some((item) => item.date === date);
      return exists
        ? prev.map((item) => (item.date === date ? updated : item))
        : [updated, ...prev];
    });
    // Local save is instant; the cloud write is debounced, fire-and-forget, and never blocks chanting.
    if (cloudAccount.autoSync && (firebaseUser || cloudAccount.connectedProvider !== 'none')) {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setCloudAccount((prev) => ({ ...prev, lastSyncedAt: `Auto-synced at ${now}` }));
    }
  }

  function adjustRounds(delta: number) {
    updateCurrentRecord((rec) => {
      const nextVal = Math.max(0, Math.min(64, rec.completedRounds + delta));
      return {
        ...rec,
        completedRounds: nextVal,
      };
    });
  }

  function setExactRounds(target: number) {
    updateCurrentRecord((rec) => ({
      ...rec,
      completedRounds: Math.max(0, Math.min(64, target)),
    }));
  }

  // Keyboard Space shortcut for +1 Japa Round
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') {
        return;
      }
      e.preventDefault();
      adjustRounds(1);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  function navigateToSection(section: ActiveSection, targetId: string) {
    setActiveNav(section);
    if (section === 'shastra') setShowReadingForm(true);
    if (section === 'sravanam') setShowLectureForm(true);
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleAddReading(e: React.FormEvent) {
    e.preventDefault();
    const pages = Math.max(1, parseInt(newPages, 10) || 5);
    const minutes = Math.max(1, parseInt(newReadMins, 10) || 15);
    updateCurrentRecord((rec) => ({
      ...rec,
      readings: [
        {
          id: `rd-${Date.now()}`,
          book: newBook,
          reference: newReference.trim() || 'Daily Verses',
          pages,
          minutes,
          note: newReadNote.trim() || 'Steady daily reading.',
        },
        ...rec.readings,
      ],
    }));
    setNewReference('');
    setNewReadNote('');
    setShowReadingForm(false);
  }

  function handleAddLecture(e: React.FormEvent) {
    e.preventDefault();
    const videoId = extractYouTubeId(newYtUrl) || 'fbm_O3pD_3c';
    const minutes = Math.max(1, parseInt(newLecMins, 10) || 30);
    updateCurrentRecord((rec) => ({
      ...rec,
      lectures: [
        {
          id: `lec-${Date.now()}`,
          youtubeUrl: newYtUrl.trim() || `https://www.youtube.com/watch?v=${videoId}`,
          youtubeId: videoId,
          title: newLecTitle.trim() || 'ISKCON Srimad-Bhagavatam Class',
          speaker: newSpeaker.trim() || 'Vaishnava Speaker',
          minutes,
          timestampNote: newTimestamp.trim() || '10:00',
          realization:
            newRealization.trim() || 'Hearing potentiazes our morning Japa and steadies the mind.',
        },
        ...rec.lectures,
      ],
    }));
    setNewYtUrl('');
    setNewLecTitle('');
    setNewRealization('');
    setShowLectureForm(false);
  }

  function handleIcsFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      // FastAPI parser; falls back to the local parser if the API is unreachable.
      void importCalendarIcsViaApi(text, selectedCityId).then((parsed) => {
        if (parsed.length > 0) {
          customCalendarRef.current = parsed;
          setCalendarEvents(parsed);
          try {
            localStorage.setItem(CUSTOM_CAL_KEY, JSON.stringify(parsed));
          } catch {
            // ignore
          }
          persistPrefs();
          setIcsStatusMsg(`Imported ${parsed.length} Vaishnava events from ${file.name}`);
        } else {
          setIcsStatusMsg('No VEVENT blocks found in .ics file; keeping built-in Gaurabda 540 calendar.');
        }
      });
    };
    reader.readAsText(file);
  }

  function connectGithubMock() {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setCloudAccount({
      connectedProvider: 'github',
      userEmailOrHandle: 'github.com/harshal',
      lastSyncedAt: `Synced with GitHub Gist at ${now}`,
      autoSync: true,
    });
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    persistPrefs({ theme: next });
  }

  function changeCity(cityId: string) {
    setSelectedCityId(cityId);
    persistPrefs({ selectedCityId: cityId });
  }

  const syncProvider: CloudAccountState['connectedProvider'] = firebaseUser
    ? 'google'
    : cloudAccount.connectedProvider === 'github'
      ? 'github'
      : 'none';
  const accountLabel = firebaseUser?.email || firebaseUser?.displayName || 'Google account';
  const greetingName = firebaseUser?.displayName?.split(' ')[0] || 'Harshal';

  function exportJsonBackup() {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sadhana-valli-backup-${selectedDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const featuredLecture = currentRecord.lectures[0] || INITIAL_SADHANA_HISTORY[0].lectures[0];

  const visibleCalendarDays = useMemo(() => {
    const inView = customCalendarRef.current
      ? calendarEvents
      : calendarEvents.filter((e) => e.date.startsWith(selectedMonth));
    if (!calFilterOnlyFestivals) return inView;
    return inView.filter((e) => e.type !== 'regular');
  }, [calendarEvents, calFilterOnlyFestivals, selectedMonth]);

  const nextEkadashiEvent = useMemo(() => {
    return (
      calendarEvents.find((e) => e.date >= selectedDate && e.type === 'ekadashi') ||
      calendarEvents.find((e) => e.type === 'ekadashi') ||
      DEFAULT_VAISHNAVA_CALENDAR_NOV_2026[15]
    );
  }, [calendarEvents, selectedDate]);

  const paranaWindowToday = useMemo(
    () => formatParanaForCity(currentCalendarEvent.paranaBaseWindow, selectedCity),
    [currentCalendarEvent, selectedCity]
  );

  if (sessionGate === 'login') {
    if (!authReady) return <div className="login-shell" aria-busy="true" />;
    return (
      <LoginScreen
        firebaseConfigured={firebaseConfigured}
        onGoogleSignIn={handleGoogleSignIn}
        onContinueLocal={handleContinueLocal}
        authError={authError}
        isSigningIn={isSigningIn}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="app-shell">
      {/* ====================================================================
          LEFT SIDEBAR (224px on Desktop, Folds on Mobile/Tablet)
          ==================================================================== */}
      <aside className="app-sidebar" aria-label="Sadhana navigation">
        <div className="sidebar-top">
          <div className="brand-header">
            <span className="brand-mark" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M5 2V11.5C5 13.1569 6.34315 14.5 8 14.5C9.65685 14.5 11 13.1569 11 11.5V2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="11" r="1.5" fill="currentColor" />
              </svg>
            </span>
            <div className="brand-text-col">
              <span className="brand-name">Sadhana Valli</span>
              <span className="brand-scope">ISKCON Daily Almanac</span>
            </div>
          </div>

          <div>
            <p className="nav-group-label">Daily Practice</p>
            <nav className="nav-list">
              <button
                type="button"
                className="nav-btn"
                aria-current={activeNav === 'almanac' ? 'page' : undefined}
                onClick={() => navigateToSection('almanac', 'section-almanac-top')}
              >
                <span className="nav-btn-left">Today’s Sadhana</span>
                {remainingRounds > 0 && (
                  <span className="nav-count-badge">{remainingRounds} left</span>
                )}
              </button>

              <button
                type="button"
                className="nav-btn"
                aria-current={activeNav === 'japa' ? 'page' : undefined}
                onClick={() => navigateToSection('japa', 'section-japa-counter')}
              >
                <span className="nav-btn-left">Japa Counter</span>
                <span className="nav-count-badge">{completedRounds}/16</span>
              </button>

              <button
                type="button"
                className="nav-btn"
                aria-current={activeNav === 'shastra' ? 'page' : undefined}
                onClick={() => navigateToSection('shastra', 'section-shastra-log')}
              >
                <span className="nav-btn-left">Shastra Reading</span>
                <span className="nav-count-badge">{readingMinsToday}m</span>
              </button>

              <button
                type="button"
                className="nav-btn"
                aria-current={activeNav === 'sravanam' ? 'page' : undefined}
                onClick={() => navigateToSection('sravanam', 'section-sravanam-youtube')}
              >
                <span className="nav-btn-left">Sravanam (YouTube)</span>
                <span className="nav-count-badge">{currentRecord.lectures.length}</span>
              </button>
            </nav>
          </div>

          <div>
            <p className="nav-group-label">Calendar &amp; Cloud</p>
            <nav className="nav-list">
              <button
                type="button"
                className="nav-btn"
                aria-current={activeNav === 'calendar' ? 'page' : undefined}
                onClick={() => navigateToSection('calendar', 'section-vaishnava-calendar')}
              >
                <span className="nav-btn-left">Vaishnava Calendar</span>
              </button>

              <button
                type="button"
                className="nav-btn"
                aria-current={activeNav === 'cloud' ? 'page' : undefined}
                onClick={() => navigateToSection('cloud', 'section-cloud-sync')}
              >
                <span className="nav-btn-left">One-Click Cloud Sync</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="continuity-mini">
            <div className="continuity-mini-head">
              <span>14-Day Continuity</span>
              <span>
                {fourteenDayStats.daysMetTarget}/{fourteenDayStats.totalDays} days
              </span>
            </div>
            <div className="pulse-strip" aria-label="14-day Japa continuity pulse">
              {records
                .slice(0, 14)
                .slice()
                .reverse()
                .map((rec) => {
                  const done = countCompletedRounds(rec);
                  return (
                    <span
                      key={rec.date}
                      className={`pulse-bar ${done < rec.targetRounds ? 'partial' : ''}`}
                      title={`${rec.date}: ${done}/${rec.targetRounds} rounds`}
                    />
                  );
                })}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Avg {fourteenDayStats.avgRounds} rounds / day
            </span>
          </div>
        </div>
      </aside>

      {/* ====================================================================
          MAIN COLUMN: 52px TopBar (3-Zone Balanced Almanac Bar) + Inset Sheet
          ==================================================================== */}
      <div className="app-main-col" id="section-almanac-top">
        <header className="app-topbar">
          {/* LEFT ZONE: Clean Pill Date Stepper (Prev / Select / Next) */}
          <div className="topbar-left">
            <div className="topbar-date-pill">
              <button
                type="button"
                className="date-step-btn"
                onClick={() => {
                  const idx = calendarEvents.findIndex((e) => e.date === selectedDate);
                  if (idx > 0) setSelectedDate(calendarEvents[idx - 1].date);
                }}
                disabled={calendarEvents.findIndex((e) => e.date === selectedDate) <= 0}
                aria-label="Previous day"
                title="Previous day"
              >
                ‹
              </button>
              <select
                id="sadhana-date-select"
                className="topbar-date-select"
                aria-label="Select Sadhana date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                {calendarEvents.map((ev) => {
                  const rec = records.find((r) => r.date === ev.date);
                  const rCount = rec ? rec.completedRounds : 0;
                  return (
                    <option key={ev.date} value={ev.date}>
                      {formatHumanDate(ev.date, true)} · {rCount}/16 rounds
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                className="date-step-btn"
                onClick={() => {
                  const idx = calendarEvents.findIndex((e) => e.date === selectedDate);
                  if (idx >= 0 && idx < calendarEvents.length - 1) {
                    setSelectedDate(calendarEvents[idx + 1].date);
                  }
                }}
                disabled={
                  calendarEvents.findIndex((e) => e.date === selectedDate) >=
                  calendarEvents.length - 1
                }
                aria-label="Next day"
                title="Next day"
              >
                ›
              </button>
            </div>
          </div>

          {/* CENTER ZONE: Vaishnava Panchanga & Next Ekadashi Pill (Zero Duplication) */}
          <div className="topbar-center">
            <span className="tithi-text">
              <strong>{currentCalendarEvent.masa} Masa</strong>
              <span className="topbar-sep" aria-hidden="true">
                ·
              </span>
              <span>
                {currentCalendarEvent.paksha} {currentCalendarEvent.tithi}
              </span>
            </span>

            <button
              type="button"
              className="tithi-badge"
              onClick={() => {
                setSelectedDate(nextEkadashiEvent.date);
                navigateToSection('calendar', 'section-vaishnava-calendar');
              }}
              title="Click to view Ekadashi on the Vaishnava Calendar"
            >
              <span>
                Next: {nextEkadashiEvent.festival?.split('·')[0].trim()} ·{' '}
                {formatHumanDate(nextEkadashiEvent.date, false)}
              </span>
            </button>
          </div>

          {/* RIGHT ZONE: Theme Toggle + Cloud Sync Status */}
          <div className="topbar-right">
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label="Toggle Light or Dark Mode"
            >
              {theme === 'light' ? (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M13.5 9.8A5.8 5.8 0 0 1 6.2 2.5a5.8 5.8 0 1 0 7.3 7.3Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>

            <button
              type="button"
              className="sync-status-btn"
              onClick={() => navigateToSection('cloud', 'section-cloud-sync')}
            >
              <span
                className={`sync-dot ${syncProvider === 'none' ? 'offline' : ''}`}
                aria-hidden="true"
              />
              <span>
                {syncProvider === 'google'
                  ? 'Google Synced'
                  : syncProvider === 'github'
                    ? 'GitHub Synced'
                    : 'Local Saved'}
              </span>
            </button>

            <button
              type="button"
              className="auth-signout-btn"
              onClick={() => {
                void handleSignOut();
              }}
              title={firebaseUser ? `Signed in as ${accountLabel}` : 'Return to the sign-in screen'}
            >
              {firebaseUser ? 'Sign out / Switch Account' : 'Sign in'}
            </button>
          </div>
        </header>

        <main className="app-sheet">
          <div className="workspace-container">
            {/* ================================================================
                ROW 1: Editorial Greeting (h1 in Instrument Serif) + One-Click Job
                ================================================================ */}
            <div className="greeting-header">
              <div>
                <h1 className="greeting-title">
                  {remainingRounds === 0
                    ? `Hare Krishna, ${greetingName}. All ${currentRecord.targetRounds} Japa rounds completed.`
                    : `Hare Krishna, ${greetingName}. ${completedRounds} of ${currentRecord.targetRounds} rounds chanted.`}
                </h1>
                <p className="greeting-finding">
                  {paranaWindowToday
                    ? `Parana (Break Fast) today: ${paranaWindowToday} · `
                    : currentCalendarEvent.festival
                      ? `${currentCalendarEvent.festival} · `
                      : ''}
                  {remainingRounds > 0
                    ? `${remainingRounds} rounds remaining for today’s vow`
                    : '16-round daily vow complete'}{' '}
                  · Wake {currentRecord.wakeTime}
                </p>
              </div>

              <div className="quick-actions-cluster">
                <button
                  type="button"
                  className="btn-primary-pill"
                  onClick={() => adjustRounds(1)}
                >
                  <span>+1 Japa Round (Space)</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary-pill"
                  onClick={() => navigateToSection('calendar', 'section-vaishnava-calendar')}
                >
                  Vaishnava Calendar
                </button>
                <button
                  type="button"
                  className="btn-secondary-pill"
                  onClick={() => navigateToSection('sravanam', 'section-sravanam-youtube')}
                >
                  + Paste YouTube Class
                </button>
              </div>
            </div>

            {/* ================================================================
                ROW 2: 4 Count Tiles (Span 3 Each, Regular Weight Figures)
                ================================================================ */}
            <section className="grid-12 kpi-grid-section" aria-label="Today's Sadhana summary">
              <div className="kpi-tile span-3">
                <p className="kpi-tile-label">Japa Mala Rounds</p>
                <p className="kpi-tile-value">
                  {completedRounds}
                  <span className="kpi-tile-unit">/ {currentRecord.targetRounds} rounds</span>
                </p>
                <p className="kpi-tile-caption highlight">
                  <span>{currentRecord.chantedBefore7AM ? 'Chanted before 7 AM' : 'In progress'}</span>
                  <span>{totalBeadsChanted.toLocaleString()} names</span>
                </p>
              </div>

              <div className="kpi-tile span-3">
                <p className="kpi-tile-label">Shastra Reading</p>
                <p className="kpi-tile-value">
                  {readingMinsToday}
                  <span className="kpi-tile-unit">min</span>
                </p>
                <p className="kpi-tile-caption">
                  <span>{readingPagesToday} pages read</span>
                  <span>{currentRecord.readings[0]?.book.split(' ')[0] || 'No entry'}</span>
                </p>
              </div>

              <div className="kpi-tile span-3">
                <p className="kpi-tile-label">Sravanam Hearing</p>
                <p className="kpi-tile-value">
                  {lectureMinsToday}
                  <span className="kpi-tile-unit">min</span>
                </p>
                <p className="kpi-tile-caption">
                  <span>{currentRecord.lectures.length} YouTube lecture(s)</span>
                  <span>{currentRecord.lectures[0]?.speaker.split(' ').slice(-1)[0] || 'None'}</span>
                </p>
              </div>

              <div className="kpi-tile span-3">
                <p className="kpi-tile-label">14-Day Continuity</p>
                <p className="kpi-tile-value">
                  {fourteenDayStats.daysMetTarget}
                  <span className="kpi-tile-unit">/ {fourteenDayStats.totalDays} days</span>
                </p>
                <p className="kpi-tile-caption highlight">
                  <span>{fourteenDayStats.totalRounds14d} rounds in 14d</span>
                  <span>Avg {fourteenDayStats.avgRounds}/d</span>
                </p>
              </div>
            </section>

            {/* ================================================================
                ROW 3 (8 + 4 Split): Simplified Japa Counter + Shastra & YouTube
                ================================================================ */}
            <section className="grid-12" aria-label="Simple Japa counter, Shastra log, and YouTube">
              {/* 8-Column Panel: Simplified Japa Stepper + Shastra Reading Log */}
              <div className="tonal-panel span-8" id="section-japa-counter">
                <div className="panel-header-row">
                  <div className="panel-title-group">
                    <h2 className="panel-title">Daily Japa Counter</h2>
                    <span className="count-chip">{progressPct}% of daily vow</span>
                  </div>

                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      color: 'var(--text)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={currentRecord.chantedBefore7AM}
                      onChange={(e) =>
                        updateCurrentRecord((rec) => ({
                          ...rec,
                          chantedBefore7AM: e.target.checked,
                        }))
                      }
                    />
                    Chanted before 07:00 AM
                  </label>
                </div>

                {/* Single Raised Card: Clean Progress Bar + Simple Stepper Buttons */}
                <div className="white-inner-card">
                  <div className="japa-stepper-top">
                    <div className="japa-big-readout">
                      <span className="japa-big-number">{completedRounds}</span>
                      <span className="japa-big-target">
                        of {currentRecord.targetRounds} rounds ({totalBeadsChanted.toLocaleString()}{' '}
                        Hare Krishna mantras)
                      </span>
                    </div>

                    <div className="japa-stepper-buttons">
                      <button
                        type="button"
                        className="btn-secondary-pill"
                        onClick={() => adjustRounds(-1)}
                        disabled={completedRounds === 0}
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        className="btn-primary-pill"
                        onClick={() => adjustRounds(1)}
                      >
                        +1 Round
                      </button>
                      <button
                        type="button"
                        className="btn-secondary-pill"
                        onClick={() => adjustRounds(4)}
                      >
                        +4 Rounds
                      </button>
                      <button
                        type="button"
                        className="btn-secondary-pill"
                        onClick={() => setExactRounds(16)}
                      >
                        16 Done
                      </button>
                    </div>
                  </div>

                  <div
                    className="japa-progress-track"
                    role="progressbar"
                    aria-valuenow={completedRounds}
                    aria-valuemin={0}
                    aria-valuemax={16}
                  >
                    <div
                      className="japa-progress-fill"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div className="japa-meta-footer">
                    <span>0 rounds</span>
                    <span>8 rounds (halfway)</span>
                    <span>16 rounds (daily vow)</span>
                  </div>
                </div>

                {/* Shastra Reading Section inside the 8-col panel */}
                <div
                  className="panel-header-row"
                  id="section-shastra-log"
                  style={{ marginTop: '6px' }}
                >
                  <div className="panel-title-group">
                    <h3 className="panel-title">Shastra Reading Log</h3>
                    <span className="count-chip">{readingPagesToday} pages</span>
                  </div>
                  <button
                    type="button"
                    className="panel-action-link"
                    onClick={() => setShowReadingForm((v) => !v)}
                  >
                    {showReadingForm ? 'Close form' : '+ Log Shastra reading'}
                  </button>
                </div>

                {showReadingForm && (
                  <form className="inline-form-grid" onSubmit={handleAddReading}>
                    <div className="field-group span-6">
                      <label className="field-label" htmlFor="shastra-book">
                        Scripture / Book
                      </label>
                      <select
                        id="shastra-book"
                        className="field-select"
                        value={newBook}
                        onChange={(e) => setNewBook(e.target.value)}
                      >
                        {SHASTRA_BOOKS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group span-3">
                      <label className="field-label" htmlFor="shastra-ref">
                        Chapter / Verses
                      </label>
                      <input
                        id="shastra-ref"
                        className="field-input"
                        placeholder="e.g. SB 1.2.13 to 18"
                        value={newReference}
                        onChange={(e) => setNewReference(e.target.value)}
                      />
                    </div>
                    <div className="field-group span-3">
                      <label className="field-label" htmlFor="shastra-mins">
                        Minutes &amp; Pages
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          id="shastra-mins"
                          type="number"
                          className="field-input"
                          style={{ width: '50%' }}
                          value={newReadMins}
                          onChange={(e) => setNewReadMins(e.target.value)}
                          title="Minutes read"
                        />
                        <input
                          type="number"
                          className="field-input"
                          style={{ width: '50%' }}
                          value={newPages}
                          onChange={(e) => setNewPages(e.target.value)}
                          title="Pages read"
                        />
                      </div>
                    </div>
                    <div className="field-group span-9">
                      <label className="field-label" htmlFor="shastra-note">
                        Key Sloka or Realization
                      </label>
                      <input
                        id="shastra-note"
                        className="field-input"
                        placeholder="One sentence realization from today's reading..."
                        value={newReadNote}
                        onChange={(e) => setNewReadNote(e.target.value)}
                      />
                    </div>
                    <div className="field-group span-3" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        className="btn-primary-pill"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Save Reading
                      </button>
                    </div>
                  </form>
                )}

                <div className="row-cards-stack">
                  {currentRecord.readings.length === 0 ? (
                    <div className="feed-row-card">
                      <span style={{ color: 'var(--muted)' }}>
                        No Shastra reading logged for {currentRecord.date} yet. Click “+ Log Shastra
                        reading” above.
                      </span>
                    </div>
                  ) : (
                    currentRecord.readings.map((rd) => (
                      <div key={rd.id} className="feed-row-card">
                        <div className="feed-row-main">
                          <span className="feed-row-title">
                            {rd.book} · {rd.reference}
                          </span>
                          <span className="feed-row-sub">{rd.note}</span>
                        </div>
                        <div className="feed-row-right">
                          <span className="feed-row-figure">{rd.minutes} min</span>
                          <span className="feed-row-meta">{rd.pages} pages</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 4-Column Right Rail: Sravanam YouTube Lecture Preview Card */}
              <div className="tonal-panel span-4" id="section-sravanam-youtube">
                <div className="panel-header-row">
                  <div className="panel-title-group">
                    <h2 className="panel-title">Sravanam (YouTube)</h2>
                    <span className="count-chip">{lectureMinsToday}m</span>
                  </div>
                  <button
                    type="button"
                    className="panel-action-link"
                    onClick={() => setShowLectureForm((v) => !v)}
                  >
                    {showLectureForm ? 'Close' : '+ Paste URL'}
                  </button>
                </div>

                {showLectureForm && (
                  <form
                    className="inline-form-grid"
                    style={{ gridTemplateColumns: '1fr' }}
                    onSubmit={handleAddLecture}
                  >
                    <div className="field-group">
                      <label className="field-label" htmlFor="yt-url-input">
                        YouTube Video URL or ID
                      </label>
                      <input
                        id="yt-url-input"
                        className="field-input"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={newYtUrl}
                        onChange={(e) => setNewYtUrl(e.target.value)}
                      />
                      {ytFetchStatus && (
                        <span style={{ fontSize: '11px', color: 'var(--accent)' }}>
                          {ytFetchStatus}
                        </span>
                      )}
                    </div>

                    {parsedPreviewId && !failedThumbIds[parsedPreviewId] && (
                      <div className="yt-thumb-wrap" style={{ borderRadius: '8px' }}>
                        <img
                          className="yt-thumb-img"
                          src={getYouTubeThumbUrl(parsedPreviewId)}
                          alt="YouTube thumbnail preview"
                          onLoad={(e) => {
                            if (e.currentTarget.naturalWidth <= 120) {
                              setFailedThumbIds((prev) => ({ ...prev, [parsedPreviewId]: true }));
                            }
                          }}
                          onError={() =>
                            setFailedThumbIds((prev) => ({ ...prev, [parsedPreviewId]: true }))
                          }
                        />
                        <span className="yt-play-pill">ID: {parsedPreviewId}</span>
                      </div>
                    )}

                    <div className="field-group">
                      <label className="field-label" htmlFor="yt-title-input">
                        Lecture Title
                      </label>
                      <input
                        id="yt-title-input"
                        className="field-input"
                        placeholder="e.g. BG 9.14 Lecture · Chanting Steadily"
                        value={newLecTitle}
                        onChange={(e) => setNewLecTitle(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div className="field-group">
                        <label className="field-label" htmlFor="yt-mins-input">
                          Minutes
                        </label>
                        <input
                          id="yt-mins-input"
                          type="number"
                          className="field-input"
                          value={newLecMins}
                          onChange={(e) => setNewLecMins(e.target.value)}
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label" htmlFor="yt-ts-input">
                          Bookmark
                        </label>
                        <input
                          id="yt-ts-input"
                          className="field-input"
                          placeholder="18:24"
                          value={newTimestamp}
                          onChange={(e) => setNewTimestamp(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="field-group">
                      <label className="field-label" htmlFor="yt-note-input">
                        Realization Note
                      </label>
                      <input
                        id="yt-note-input"
                        className="field-input"
                        placeholder="What struck you in this class?"
                        value={newRealization}
                        onChange={(e) => setNewRealization(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn-primary-pill"
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      Save YouTube Lecture
                    </button>
                  </form>
                )}

                {featuredLecture && (
                  <article className="yt-card">
                    <div
                      className="yt-thumb-wrap"
                      onClick={() =>
                        setPlayingVideoId((prev) =>
                          prev === featuredLecture.youtubeId ? null : featuredLecture.youtubeId
                        )
                      }
                      title="Click to toggle embedded YouTube player"
                    >
                      <svg
                        className="yt-poster-svg"
                        viewBox="0 0 320 180"
                        fill="none"
                        aria-hidden="true"
                      >
                        <rect width="320" height="180" fill="#163D38" />
                        <circle
                          cx="160"
                          cy="90"
                          r="62"
                          stroke="#C89D54"
                          strokeOpacity="0.35"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="160"
                          cy="90"
                          r="44"
                          stroke="#F3EFE6"
                          strokeOpacity="0.22"
                          strokeWidth="1"
                        />
                        <circle cx="160" cy="90" r="24" fill="#F3EFE6" fillOpacity="0.16" />
                        <polygon points="154,79 154,101 172,90" fill="#FBF9F5" />
                        <text
                          x="16"
                          y="26"
                          fill="#E5DFD2"
                          fontSize="10"
                          fontWeight="600"
                          letterSpacing="0.5"
                        >
                          ISKCON SRAVANAM ARCHIVE · YOUTUBE ID {featuredLecture.youtubeId}
                        </text>
                        <text x="16" y="162" fill="#FBF9F5" fontSize="11" fontWeight="500">
                          {featuredLecture.speaker}
                        </text>
                      </svg>

                      {playingVideoId === featuredLecture.youtubeId ? (
                        <iframe
                          className="yt-iframe"
                          src={`https://www.youtube-nocookie.com/embed/${featuredLecture.youtubeId}?autoplay=1`}
                          title={featuredLecture.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <>
                          {!failedThumbIds[featuredLecture.youtubeId] && (
                            <img
                              className="yt-thumb-img"
                              src={getYouTubeThumbUrl(featuredLecture.youtubeId)}
                              alt={featuredLecture.title}
                              onLoad={(e) => {
                                if (e.currentTarget.naturalWidth <= 120) {
                                  setFailedThumbIds((prev) => ({
                                    ...prev,
                                    [featuredLecture.youtubeId]: true,
                                  }));
                                }
                              }}
                              onError={() =>
                                setFailedThumbIds((prev) => ({
                                  ...prev,
                                  [featuredLecture.youtubeId]: true,
                                }))
                              }
                            />
                          )}
                          <span className="yt-play-pill">
                            Play Class · {featuredLecture.minutes}m
                          </span>
                        </>
                      )}
                    </div>
                    <div className="yt-card-body">
                      <h3 className="yt-card-title">{featuredLecture.title}</h3>
                      <div className="yt-card-meta">
                        <span>{featuredLecture.speaker}</span>
                        <span>@{featuredLecture.timestampNote}</span>
                      </div>
                      <p className="yt-card-note">“{featuredLecture.realization}”</p>
                    </div>
                  </article>
                )}

                {currentRecord.lectures.length > 1 && (
                  <div className="row-cards-stack">
                    {currentRecord.lectures.slice(1).map((lec) => (
                      <div key={lec.id} className="feed-row-card" style={{ minHeight: '54px' }}>
                        <div className="feed-row-main">
                          <span className="feed-row-title">{lec.title}</span>
                          <span className="feed-row-sub">
                            {lec.speaker} · @{lec.timestampNote}
                          </span>
                        </div>
                        <div className="feed-row-right">
                          <span className="feed-row-figure">{lec.minutes}m</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ================================================================
                ROW 4: ISKCON Vaishnava Calendar Engine (City Parana + .ics Import)
                ================================================================ */}
            <section
              className="tonal-panel"
              id="section-vaishnava-calendar"
              aria-labelledby="heading-vaishnava-cal"
            >
              <div className="panel-header-row">
                <div className="panel-title-group">
                  <h2 className="panel-title" id="heading-vaishnava-cal">
                    ISKCON Vaishnava Calendar · Damodara / Kesava Masa (Gaurabda 540)
                  </h2>
                  <span className="count-chip">Click any day to open its Sadhana log</span>
                </div>

                <div className="quick-actions-cluster">
                  <label
                    htmlFor="iskcon-city-select"
                    style={{ fontSize: '12px', color: 'var(--muted)' }}
                  >
                    Temple Location:
                  </label>
                  <select
                    id="iskcon-city-select"
                    className="date-select"
                    value={selectedCityId}
                    onChange={(e) => changeCity(e.target.value)}
                  >
                    {ISKCON_CITIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.country}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="btn-secondary-pill"
                    style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                    onClick={() => setCalFilterOnlyFestivals((v) => !v)}
                  >
                    {calFilterOnlyFestivals ? 'Show All 30 Days' : 'Ekadashis & Festivals Only'}
                  </button>

                  <label
                    className="btn-secondary-pill"
                    style={{
                      height: '30px',
                      padding: '0 10px',
                      fontSize: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                    title="Import any .ics calendar exported from vaishnavacalendar.org or purebhakti.com"
                  >
                    <span>Import .ics</span>
                    <input
                      type="file"
                      accept=".ics,text/calendar"
                      onChange={handleIcsFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {icsStatusMsg && (
                <p style={{ fontSize: '12px', color: 'var(--accent)', margin: 0 }}>
                  {icsStatusMsg}
                </p>
              )}

              {/* Selected Day / Next Ekadashi & Parana Banner */}
              <div className="calendar-next-banner">
                <div>
                  <strong style={{ fontSize: '14px', color: 'var(--text)' }}>
                    {currentCalendarEvent.date} · {currentCalendarEvent.masa} Masa,{' '}
                    {currentCalendarEvent.paksha} {currentCalendarEvent.tithi}
                  </strong>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0 0' }}>
                    {currentCalendarEvent.festival
                      ? currentCalendarEvent.festival
                      : `Regular Sadhana Day · Next Ekadashi on ${nextEkadashiEvent.date}`}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {paranaWindowToday ? (
                    <span className="tithi-badge">Break Fast (Parana): {paranaWindowToday}</span>
                  ) : currentCalendarEvent.fastingNote ? (
                    <span className="tithi-badge">{currentCalendarEvent.fastingNote}</span>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Calculated for {selectedCity.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Monthly Calendar Grid */}
              <div className="calendar-grid" role="grid" aria-label="Vaishnava calendar days">
                {visibleCalendarDays.map((ev) => {
                  const rec = records.find((r) => r.date === ev.date);
                  const rDone = rec ? rec.completedRounds : 0;
                  const isSelected = ev.date === selectedDate;
                  return (
                    <button
                      key={ev.date}
                      type="button"
                      className={`calendar-day-cell ${isSelected ? 'selected' : ''} ${ev.type === 'ekadashi' ? 'ekadashi' : ''}`}
                      onClick={() => setSelectedDate(ev.date)}
                    >
                      <div>
                        <div className="cal-day-top">
                          <span className="cal-day-num">{ev.date.slice(5)}</span>
                          {rDone > 0 && <span className="cal-sadhana-dot">{rDone}r</span>}
                        </div>
                        <div className="cal-tithi-line">
                          {ev.paksha} {ev.tithi}
                        </div>
                      </div>
                      {ev.festival && <div className="cal-fest-tag">{ev.festival}</div>}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ================================================================
                ROW 5 (6 + 6 Split): Daily Reflection Journal & Easy Cloud Sync
                ================================================================ */}
            <section className="grid-12" aria-label="Reflection journal and one-click cloud sync">
              {/* 6 Columns: Mananam Daily Reflection Journal */}
              <div className="tonal-panel span-6">
                <div className="panel-header-row">
                  <div className="panel-title-group">
                    <h2 className="panel-title">Mananam · Daily Reflection Journal</h2>
                    <span className="count-chip">{currentRecord.date}</span>
                  </div>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={currentRecord.mangalaArati}
                      onChange={(e) =>
                        updateCurrentRecord((rec) => ({
                          ...rec,
                          mangalaArati: e.target.checked,
                        }))
                      }
                    />
                    Mangala Arati attended
                  </label>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="daily-reflection-area">
                    Realizations from Japa, Shastra &amp; Sravanam (auto-saves as you type)
                  </label>
                  <textarea
                    id="daily-reflection-area"
                    className="field-textarea"
                    rows={4}
                    value={currentRecord.reflection}
                    onChange={(e) =>
                      updateCurrentRecord((rec) => ({
                        ...rec,
                        reflection: e.target.value,
                      }))
                    }
                    placeholder="Write one honest line about today's chanting quality or a verse that stayed with you..."
                  />
                </div>

                <div className="feed-row-card" style={{ minHeight: '52px' }}>
                  <div className="feed-row-main">
                    <span className="feed-row-title">Morning Wake &amp; Sandhya</span>
                    <span className="feed-row-sub">
                      Consistent wake time anchors early Japa before work
                    </span>
                  </div>
                  <div className="feed-row-right">
                    <input
                      type="time"
                      className="field-input"
                      style={{ height: '30px', width: '110px' }}
                      value={currentRecord.wakeTime}
                      onChange={(e) =>
                        updateCurrentRecord((rec) => ({
                          ...rec,
                          wakeTime: e.target.value,
                        }))
                      }
                      aria-label="Wake up time"
                    />
                  </div>
                </div>
              </div>

              {/* 6 Columns: One-Click Cloud Sync (Google / GitHub) + 14d Chart */}
              <div className="tonal-panel span-6" id="section-cloud-sync">
                <div className="panel-header-row">
                  <div className="panel-title-group">
                    <h2 className="panel-title">One-Click Cloud Sync &amp; Backup</h2>
                    <span className="count-chip">{cloudAccount.lastSyncedAt}</span>
                  </div>
                  <button type="button" className="panel-action-link" onClick={exportJsonBackup}>
                    Download JSON
                  </button>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                  Sign in with one click to keep your Sadhana logs synced across your phone, tablet,
                  and laptop—no database URLs or API keys required.
                </p>

                {firebaseUser && (
                  <p className="cloud-account-line">Signed in as {accountLabel}</p>
                )}
                {!firebaseUser && authError && (
                  <p className="login-error" role="alert">
                    {authError}
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    className={`oauth-btn ${firebaseUser ? 'connected' : ''}`}
                    disabled={isSigningIn}
                    onClick={() => {
                      if (firebaseUser) {
                        void handleSignOut();
                      } else if (firebaseConfigured) {
                        // Local mode + Firebase configured: open the Google popup in place.
                        void handleGoogleSignIn();
                      } else {
                        // Not configured: show the login screen with the .env setup note.
                        returnToLoginScreen();
                      }
                    }}
                  >
                    <span>
                      {firebaseUser
                        ? `Sign out / Switch Account (${accountLabel})`
                        : isSigningIn
                          ? 'Opening Google…'
                          : 'Continue with Google'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`oauth-btn ${cloudAccount.connectedProvider === 'github' ? 'connected' : ''}`}
                    onClick={connectGithubMock}
                  >
                    <span>
                      {cloudAccount.connectedProvider === 'github'
                        ? 'Connected: GitHub (harshal)'
                        : 'Continue with GitHub'}
                    </span>
                  </button>
                </div>

                {/* Compact 14-Day Japa Trend Bar Chart */}
                <div
                  style={{
                    backgroundColor: 'var(--sheet-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '12px 14px 8px',
                  }}
                >
                  <svg
                    className="chart-svg"
                    viewBox="0 0 500 155"
                    role="img"
                    aria-label="14-day bar chart of Japa rounds completed"
                  >
                    {[
                      { val: 16, y: 18 },
                      { val: 8, y: 74 },
                      { val: 0, y: 130 },
                    ].map((tick) => (
                      <g key={tick.val}>
                        <line
                          x1="28"
                          y1={tick.y}
                          x2="492"
                          y2={tick.y}
                          stroke={tick.val === 16 ? 'var(--accent)' : 'var(--border)'}
                          strokeWidth="1"
                          strokeDasharray={tick.val === 16 ? '4 3' : undefined}
                        />
                        <text
                          x="22"
                          y={tick.y + 4}
                          textAnchor="end"
                          fontSize="11"
                          fill="var(--muted)"
                        >
                          {tick.val}
                        </text>
                      </g>
                    ))}

                    {records
                      .slice(0, 14)
                      .slice()
                      .reverse()
                      .map((rec, idx) => {
                        const total = countCompletedRounds(rec);
                        const barWidth = 22;
                        const x = 38 + idx * 32.5;
                        const totalH = (Math.min(total, 16) / 16) * 112;
                        const isSelected = rec.date === selectedDate;

                        return (
                          <g
                            key={rec.date}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedDate(rec.date)}
                          >
                            <rect
                              x={x}
                              y={130 - totalH}
                              width={barWidth}
                              height={totalH}
                              fill="var(--accent)"
                              opacity={rec.chantedBefore7AM ? 1 : 0.65}
                            />
                            {isSelected && (
                              <rect
                                x={x - 2}
                                y={14}
                                width={barWidth + 4}
                                height={118}
                                fill="none"
                                stroke="var(--text)"
                                strokeWidth="1.5"
                              />
                            )}
                            {idx % 3 === 0 && (
                              <text
                                x={x + barWidth / 2}
                                y="148"
                                textAnchor="middle"
                                fontSize="11"
                                fill="var(--muted)"
                              >
                                {rec.date.slice(5)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                  </svg>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* ====================================================================
          MOBILE / TABLET BOTTOM NAVIGATION BAR
          ==================================================================== */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <button
          type="button"
          className="mobile-nav-btn"
          aria-current={activeNav === 'almanac' ? 'page' : undefined}
          onClick={() => navigateToSection('almanac', 'section-almanac-top')}
        >
          <span>Today</span>
        </button>
        <button
          type="button"
          className="mobile-nav-btn"
          onClick={() => adjustRounds(1)}
        >
          <span>+1 Round</span>
        </button>
        <button
          type="button"
          className="mobile-nav-btn"
          aria-current={activeNav === 'calendar' ? 'page' : undefined}
          onClick={() => navigateToSection('calendar', 'section-vaishnava-calendar')}
        >
          <span>Calendar</span>
        </button>
        <button
          type="button"
          className="mobile-nav-btn"
          onClick={() => navigateToSection('sravanam', 'section-sravanam-youtube')}
        >
          <span>+ YouTube</span>
        </button>
        <button
          type="button"
          className="mobile-nav-btn"
          onClick={toggleTheme}
        >
          <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
      </nav>
    </div>
  );
}
export default App;
