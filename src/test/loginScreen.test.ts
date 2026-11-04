import { describe, it, expect } from 'vitest';
import { INITIAL_SADHANA_HISTORY } from '../sadhanaData';
import { resolveInitialSessionGate, resolveLocalSeedForUser, SIGNED_OUT_UID } from '../components/LoginScreen';

describe('resolveInitialSessionGate', () => {
  it('requires login screen when no Firebase user and no local mode opt-in', () => {
    expect(resolveInitialSessionGate(null, null)).toBe('login');
  });

  it('enters workspace when Firebase user is present', () => {
    expect(resolveInitialSessionGate({ uid: 'u1', email: 'harshal@example.com' }, null)).toBe('authenticated');
  });

  it('enters workspace in local mode when user chose local offline mode', () => {
    expect(resolveInitialSessionGate(null, 'local')).toBe('local');
  });
});

describe('resolveLocalSeedForUser', () => {
  const edited = { ...INITIAL_SADHANA_HISTORY[0], completedRounds: 9, updatedAt: '2026-11-02T08:00:00.000Z' };
  const editedNoStamp = { ...INITIAL_SADHANA_HISTORY[1], reflection: 'changed without stamp' };
  const newDay = { ...INITIAL_SADHANA_HISTORY[0], date: '2026-11-03' };

  it('never uploads untouched demo history on a fresh browser', () => {
    expect(resolveLocalSeedForUser(INITIAL_SADHANA_HISTORY, null, 'user-1')).toEqual([]);
  });

  it('migrates only user-edited records on the first-ever login', () => {
    const seed = resolveLocalSeedForUser([edited, editedNoStamp, INITIAL_SADHANA_HISTORY[2]], null, 'user-1');
    expect(seed).toEqual([edited, editedNoStamp]);
  });

  it('treats a record with an updatedAt stamp or a non-demo date as user-edited', () => {
    expect(resolveLocalSeedForUser([edited], null, 'user-1')).toEqual([edited]);
    expect(resolveLocalSeedForUser([newDay], null, 'user-1')).toEqual([newDay]);
  });

  it('returns nothing when the same user returns (Firestore persistentLocalCache owns their data)', () => {
    expect(resolveLocalSeedForUser([edited, editedNoStamp], 'user-a', 'user-a')).toEqual([]);
    expect(resolveLocalSeedForUser(INITIAL_SADHANA_HISTORY, 'user-a', 'user-a')).toEqual([]);
  });

  it('returns an empty seed when switching from one account to another', () => {
    expect(resolveLocalSeedForUser([edited], 'user-a', 'user-b')).toEqual([]);
  });

  it('does not upload untouched demo records after a sign-out', () => {
    expect(resolveLocalSeedForUser(INITIAL_SADHANA_HISTORY, SIGNED_OUT_UID, 'user-b')).toEqual([]);
  });

  it('migrates only local-mode edits made after a sign-out', () => {
    const records = [edited, ...INITIAL_SADHANA_HISTORY.slice(1)];
    expect(resolveLocalSeedForUser(records, SIGNED_OUT_UID, 'user-b')).toEqual([edited]);
  });
});
