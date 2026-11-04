import React, { useState } from 'react';
import { INITIAL_SADHANA_HISTORY, type DailySadhanaRecord } from '../sadhanaData';

export type SessionGate = 'login' | 'authenticated' | 'local';
export type EmailAuthMode = 'signin' | 'signup';

export const SESSION_MODE_KEY = 'sadhana_valli_session_mode_v1';

/**
 * Validates email and password before calling Firebase Email/Password Auth.
 * Returns a human-readable error message or `null` when valid.
 */
export function validateEmailPasswordInput(email: string, password: string): string | null {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return 'Enter a valid email address.';
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters.';
  }
  return null;
}

/**
 * Decides which screen to show first.
 * A signed-in Firebase user always wins; otherwise a stored "local" opt-in
 * lets the user straight into the offline workspace; otherwise show login.
 */
export function resolveInitialSessionGate(
  user: { uid: string; email?: string | null } | null,
  storedMode: string | null
): SessionGate {
  if (user) return 'authenticated';
  if (storedMode === 'local') return 'local';
  return 'login';
}

export const LAST_SYNCED_UID_KEY = 'sadhana_valli_last_uid_v1';
/** Stored after sign-out so the next login is never mistaken for a first-ever (anonymous) login. */
export const SIGNED_OUT_UID = '__signed_out__';

const DEMO_BY_DATE = new Map<string, DailySadhanaRecord>(
  INITIAL_SADHANA_HISTORY.map((r) => [r.date, r])
);

/**
 * Has the user actually touched this record? True when it carries an `updatedAt` stamp
 * (set by every edit) or its content differs from the built-in demo day with the same date.
 * Untouched demo history is never "user data".
 */
function isUserEditedRecord(record: { date: string; updatedAt?: string }): boolean {
  if (record.updatedAt) return true;
  const demo = DEMO_BY_DATE.get(record.date);
  return !demo || JSON.stringify(demo) !== JSON.stringify(record);
}

/**
 * Which local records may be uploaded into the account that just signed in?
 * - never synced / signed out (anonymous or local-mode data) -> migrate only the records the user
 *   actually edited; untouched demo history is never uploaded
 * - same account returning -> nothing. Firestore's `persistentLocalCache` already holds that
 *   account's data and any queued offline writes; re-seeding old localStorage copies with
 *   `Math.max` merging could undo corrections (e.g. -1 round) made on another device.
 * - a different real account than last time -> nothing; never leak account A into account B
 */
export function resolveLocalSeedForUser<T extends { date: string; updatedAt?: string }>(
  currentRecords: T[],
  lastSyncedUid: string | null,
  incomingUid: string
): T[] {
  if (lastSyncedUid === incomingUid) return [];
  if (lastSyncedUid === null || lastSyncedUid === SIGNED_OUT_UID) {
    return currentRecords.filter(isUserEditedRecord);
  }
  return [];
}

export interface LoginScreenProps {
  firebaseConfigured: boolean;
  onGoogleSignIn: () => Promise<void>;
  onEmailAuth?: (email: string, password: string, mode: EmailAuthMode) => Promise<void>;
  onContinueLocal: () => void;
  authError: string | null;
  isSigningIn: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function LoginScreen({
  firebaseConfigured,
  onGoogleSignIn,
  onEmailAuth,
  onContinueLocal,
  authError,
  isSigningIn,
  theme,
  onToggleTheme,
}: LoginScreenProps): React.JSX.Element {
  const [emailMode, setEmailMode] = useState<EmailAuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErr = validateEmailPasswordInput(email, password);
    if (validationErr) {
      setLocalValidationError(validationErr);
      return;
    }
    setLocalValidationError(null);
    if (onEmailAuth) {
      await onEmailAuth(email.trim(), password, emailMode);
    }
  }

  const displayedError = localValidationError || authError;

  return (
    <div className="login-shell">
      <button
        type="button"
        className="theme-toggle-btn login-theme-toggle"
        onClick={onToggleTheme}
        aria-label="Toggle Light or Dark Mode"
      >
        <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
      </button>

      <main className="login-card" aria-labelledby="login-heading">
        <span className="brand-mark login-brand-mark" aria-hidden="true">
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
        <p className="login-eyebrow">Sadhana Valli · ISKCON Daily Almanac</p>
        <h1 className="login-heading" id="login-heading">
          Hare Krishna. Begin today’s Japa.
        </h1>
        <p className="login-lede">
          Sign in with Google or Email to keep your rounds, readings, and reflections synced across
          devices. Or chant right now in Local Offline Mode.
        </p>

        <div className="login-actions">
          <button
            type="button"
            className="btn-primary-pill login-btn"
            onClick={() => {
              setLocalValidationError(null);
              void onGoogleSignIn();
            }}
            disabled={isSigningIn || !firebaseConfigured}
          >
            {isSigningIn ? 'Signing in…' : 'Continue with Google'}
          </button>
        </div>

        <div className="login-divider" aria-hidden="true">
          <span>or use email &amp; password</span>
        </div>

        <form className="login-email-form" onSubmit={(e) => void handleEmailSubmit(e)} noValidate>
          <div className="field-group">
            <label className="field-label" htmlFor="login-email-input">
              Email Address
            </label>
            <input
              id="login-email-input"
              type="email"
              className="field-input"
              placeholder="practitioner@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSigningIn || !firebaseConfigured}
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="login-password-input">
              Password (6+ characters)
            </label>
            <input
              id="login-password-input"
              type="password"
              className="field-input"
              placeholder="••••••••"
              autoComplete={emailMode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSigningIn || !firebaseConfigured}
            />
          </div>

          <div className="login-email-actions">
            <button
              type="submit"
              className="btn-secondary-pill login-btn"
              disabled={isSigningIn || !firebaseConfigured}
            >
              {emailMode === 'signin' ? 'Sign in with Email' : 'Create Email Account'}
            </button>

            <button
              type="button"
              className="panel-action-link login-mode-switch"
              onClick={() => {
                setLocalValidationError(null);
                setEmailMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
              }}
            >
              {emailMode === 'signin'
                ? 'Need an account? Create one with Email'
                : 'Already have an account? Sign in with Email'}
            </button>
          </div>
        </form>

        <div className="login-actions">
          <button type="button" className="btn-secondary-pill login-btn" onClick={onContinueLocal}>
            Continue in Local Offline Mode
          </button>
        </div>

        {displayedError && (
          <p className="login-error" role="alert">
            {displayedError}
          </p>
        )}

        {!firebaseConfigured && (
          <p className="login-note">
            Firebase Auth is not set up yet. Add your <code>VITE_FIREBASE_*</code> keys to a{' '}
            <code>.env</code> file and restart the dev server. Local Offline Mode works without
            them.
          </p>
        )}
      </main>
    </div>
  );
}

export default LoginScreen;
