import { describe, it, expect } from 'vitest';
import { resolveInitialSessionGate, resolveLocalSeedForUser } from '../components/LoginScreen';

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
  const records = [{ date: '2026-11-02' }, { date: '2026-11-01' }];

  it('migrates local records on the first-ever login', () => {
    expect(resolveLocalSeedForUser(records, null, 'user-a')).toBe(records);
  });

  it('keeps local records when the same user returns', () => {
    expect(resolveLocalSeedForUser(records, 'user-a', 'user-a')).toBe(records);
  });

  it('returns an empty seed when switching from one account to another', () => {
    expect(resolveLocalSeedForUser(records, 'user-a', 'user-b')).toEqual([]);
  });
});
