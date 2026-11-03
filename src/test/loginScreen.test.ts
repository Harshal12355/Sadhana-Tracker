import { describe, it, expect } from 'vitest';
import { resolveInitialSessionGate } from '../components/LoginScreen';

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
