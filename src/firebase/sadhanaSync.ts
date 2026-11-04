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

/** Key-order-independent JSON, so Firestore's arbitrary key order never matters. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Same content? `updatedAt` is ignored (it is bookkeeping, not data). */
function sameRecordContent(a: TimestampedSadhanaRecord, b: TimestampedSadhanaRecord): boolean {
  const { updatedAt: _a, ...restA } = a;
  const { updatedAt: _b, ...restB } = b;
  return canonical(restA) === canonical(restB);
}

/**
 * Save one day. By default stamps a fresh `updatedAt` (a user edit).
 * Pass `{ preserveUpdatedAt: true }` for backfills so the original ordering survives.
 */
export async function saveDayRecordToFirestore(
  uid: string,
  record: TimestampedSadhanaRecord,
  options?: { preserveUpdatedAt?: boolean }
): Promise<void> {
  const clients = getFirebaseClients();
  if (!clients) return;
  const payload: TimestampedSadhanaRecord = options?.preserveUpdatedAt
    ? { ...record }
    : { ...record, updatedAt: new Date().toISOString() };
  // merge:true so fields this client does not know about (or other devices wrote) are never
  // dropped. Arrays (readings/lectures) are still replaced as a whole, which keeps deletions
  // working; the UI record being saved was already merged with the latest snapshot.
  await setDoc(doc(clients.db, 'users', uid, 'days', record.date), clean(payload), { merge: true });
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

/**
 * One step of the snapshot state machine. Mutates `pendingSeeds` and `writtenBackfillDates`.
 *
 * - Always merges still-pending local seeds with `remote`, so the UI never empties
 *   while backfill writes are in flight.
 * - Retires a seed once Firestore holds identical content for that day.
 * - Schedules each backfill write at most once per date.
 */
export function reconcileSnapshotWithSeed(
  remote: TimestampedSadhanaRecord[],
  pendingSeeds: Map<string, TimestampedSadhanaRecord>,
  writtenBackfillDates: Set<string>
): { merged: TimestampedSadhanaRecord[]; toWrite: TimestampedSadhanaRecord[] } {
  const merged = mergeRecordLists(Array.from(pendingSeeds.values()), remote);
  const remoteByDate = new Map(remote.map((r) => [r.date, r]));
  const toWrite: TimestampedSadhanaRecord[] = [];

  for (const m of merged) {
    const r = remoteByDate.get(m.date);
    if (r && sameRecordContent(m, r)) {
      pendingSeeds.delete(m.date);
    } else if (!writtenBackfillDates.has(m.date)) {
      writtenBackfillDates.add(m.date);
      toWrite.push(m);
    }
  }
  return { merged, toWrite };
}

/**
 * Snapshot step that is safe to run on cache-only snapshots: the UI always gets `merged`
 * immediately, but backfill writes are only scheduled once the server has spoken
 * (`fromCache === false`), so a stale offline cache can never drive writes over newer cloud data.
 */
export function processSnapshot(
  remote: TimestampedSadhanaRecord[],
  fromCache: boolean,
  pendingSeeds: Map<string, TimestampedSadhanaRecord>,
  writtenBackfillDates: Set<string>
): { merged: TimestampedSadhanaRecord[]; toWrite: TimestampedSadhanaRecord[] } {
  if (!fromCache) return reconcileSnapshotWithSeed(remote, pendingSeeds, writtenBackfillDates);
  // Use a throwaway copy so cache snapshots do not mark dates as "already written".
  const { merged } = reconcileSnapshotWithSeed(remote, pendingSeeds, new Set(writtenBackfillDates));
  return { merged, toWrite: [] };
}

export function subscribeToUserSadhana(
  uid: string,
  localSeed: DailySadhanaRecord[],
  onRecords: (records: DailySadhanaRecord[]) => void,
  onPrefs?: (prefs: UserPrefs) => void,
  onPrefsMissing?: () => void
): () => void {
  const clients = getFirebaseClients();
  if (!clients) {
    onRecords(localSeed);
    return () => {};
  }

  const { db } = clients;
  const pendingSeeds = new Map<string, TimestampedSadhanaRecord>(
    localSeed.map((r) => [r.date, r as TimestampedSadhanaRecord])
  );
  const writtenBackfillDates = new Set<string>();
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'days'),
      (snap) => {
        const remote = snap.docs.map((d) => d.data() as TimestampedSadhanaRecord);
        const { merged, toWrite } = processSnapshot(
          remote,
          snap.metadata.fromCache,
          pendingSeeds,
          writtenBackfillDates
        );
        onRecords(merged);
        for (const rec of toWrite) {
          void saveDayRecordToFirestore(uid, rec, { preserveUpdatedAt: true }).catch(() => {});
        }
      },
      () => {
        // Permission / network error: keep working from local data.
        onRecords(localSeed);
      }
    )
  );

  if (onPrefs || onPrefsMissing) {
    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (!snap.exists()) {
            // Only the server can confirm the user doc really does not exist yet.
            if (!snap.metadata.fromCache) onPrefsMissing?.();
            return;
          }
          const data = snap.data() as UserPrefs;
          onPrefs?.({
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
