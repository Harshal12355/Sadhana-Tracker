import React from 'react';

export type SessionGate = 'login' | 'authenticated' | 'local';

export const SESSION_MODE_KEY = 'sadhana_valli_session_mode_v1';

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

export interface LoginScreenProps {
  firebaseConfigured: boolean;
  onGoogleSignIn: () => Promise<void>;
  onContinueLocal: () => void;
  authError: string | null;
  isSigningIn: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function LoginScreen({
  firebaseConfigured,
  onGoogleSignIn,
  onContinueLocal,
  authError,
  isSigningIn,
  theme,
  onToggleTheme,
}: LoginScreenProps): React.JSX.Element {
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
          Sign in to keep your rounds, readings and reflections in sync across devices. Or chant
          right now without an account — your log stays on this device.
        </p>

        <div className="login-actions">
          <button
            type="button"
            className="btn-primary-pill login-btn"
            onClick={() => {
              void onGoogleSignIn();
            }}
            disabled={isSigningIn || !firebaseConfigured}
          >
            {isSigningIn ? 'Opening Google…' : 'Continue with Google'}
          </button>
          <button type="button" className="btn-secondary-pill login-btn" onClick={onContinueLocal}>
            Continue in Local Offline Mode
          </button>
        </div>

        {authError && (
          <p className="login-error" role="alert">
            {authError}
          </p>
        )}

        {!firebaseConfigured && (
          <p className="login-note">
            Google sign-in is not set up yet. Add your <code>VITE_FIREBASE_*</code> keys to a{' '}
            <code>.env</code> file and restart the dev server. Local Offline Mode works without
            them.
          </p>
        )}
      </main>
    </div>
  );
}

export default LoginScreen;
