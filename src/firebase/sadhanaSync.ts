import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { DailySadhanaRecord, VaishnavaEvent } from '../sadhanaData';
import { getFirebaseClients } from './config';

export type TimestampedSadhanaRecord = DailySadhanaRecord & { updatedAt?: string };

export interface UserPrefs {
  theme?: 'light' | 'dark';
  selectedCityId?: string;
  customCalendarEvents?: VaishnavaEvent[];
}

function stamp(record: TimestampedSadhanaRecord): number {
  const t = record.updatedAt ? Date.parse(record.updatedAt) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/** Union by id; items from `primary` (the newer record) come first. */
function unionById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...primary, ...secondary]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function mergeDailyRecords(
  local: TimestampedSadhanaRecord,
  remote: TimestampedSadhanaRecord
): TimestampedSadhanaRecord {
  // Ties go to local.
  const localIsNewer = stamp(local) >= stamp(remote);
  const newer = localIsNewer ? local : remote;
  const older = localIsNewer ? remote : local;

  let reflection: string;
  if (!local.reflection) reflection = remote.reflection;
  else if (!remote.reflection) reflection = local.reflection;
  else if (local.reflection === remote.reflection) reflection = local.reflection;
  else reflection = newer.reflection;

  const updatedAt = [local.updatedAt, remote.updatedAt]
    .filter((v): v is string => Boolean(v))
    .sort()
    .pop();

  return {
    ...newer,
    completedRounds: Math.max(local.completedRounds, remote.completedRounds),
    chantedBefore7AM: local.chantedBefore7AM || remote.chantedBefore7AM,
    mangalaArati: local.mangalaArati || remote.mangalaArati,
    readings: unionById(newer.readings, older.readings),
    lectures: unionById(newer.lectures, older.lectures),
    reflection,
    wakeTime: newer.wakeTime || '05:00',
    ...(updatedAt ? { updatedAt } : {}),
  };
}

export function mergeRecordLists(
  localList: TimestampedSadhanaRecord[],
  remoteList: TimestampedSadhanaRecord[]
): TimestampedSadhanaRecord[] {
  const byDate = new Map<string, TimestampedSadhanaRecord>();
  for (const rec of localList) byDate.set(rec.date, rec);
  for (const rec of remoteList) {
    const existing = byDate.get(rec.date);
    byDate.set(rec.date, existing ? mergeDailyRecords(existing, rec) : rec);
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

// Firestore rejects `undefined` values; JSON round-trip drops them.
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function saveDayRecordToFirestore(
  uid: string,
  record: DailySadhanaRecord
): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) return;
  const payload: TimestampedSadhanaRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(clients.db, 'users', uid, 'days', record.date), clean(payload));
}

export async function saveUserPrefsToFirestore(
  uid: string,
  prefs: {
    theme: 'light' | 'dark';
    selectedCityId: string;
    customCalendarEvents?: VaishnavaEvent[];
  }
): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) return;
  await setDoc(
    doc(clients.db, 'users', uid),
    clean({ ...prefs, updatedAt: new Date().toISOString() }),
    { merge: true }
  );
}

export function subscribeToUserSadhana(
  uid: string,
  localSeed: DailySadhanaRecord[],
  onRecords: (records: DailySadhanaRecord[]) => void,
  onPrefs?: (prefs: UserPrefs) => void
): () => void {
  const clients = getFirebaseClients();
  if (!clients) {
    onRecords(localSeed);
    return () => {};
  }

  const { db } = clients;
  let firstSnapshot = true;
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'days'),
      (snap) => {
        const remote = snap.docs.map((d) => d.data() as TimestampedSadhanaRecord);
        const merged = mergeRecordLists(localSeed, remote);
        onRecords(merged);

        if (firstSnapshot) {
          firstSnapshot = false;
          // Push anything that only exists locally, or where the merge added data.
          const remoteByDate = new Map(remote.map((r) => [r.date, r]));
          for (const rec of merged) {
            const r = remoteByDate.get(rec.date);
            if (!r || JSON.stringify(clean(r)) !== JSON.stringify(clean(rec))) {
              void saveDayRecordToFirestore(uid, rec).catch(() => {});
            }
          }
        }
      },
      () => {
        // Permission / network error: keep working from local data.
        onRecords(localSeed);
      }
    )
  );

  if (onPrefs) {
    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as UserPrefs;
          onPrefs({
            theme: data.theme,
            selectedCityId: data.selectedCityId,
            customCalendarEvents: data.customCalendarEvents,
          });
        },
        () => {}
      )
    );
  }

  return () => unsubs.forEach((u) => u());
}
