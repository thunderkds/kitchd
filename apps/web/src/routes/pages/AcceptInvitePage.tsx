import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getUser, setToken, setUser } from '../auth';
import { apiThemeToId } from '../../theme/themeMapping';
import { acceptInvite } from '../../features/team/api';

const MIN_PASSWORD_LENGTH = 8;

/**
 * T043 — public invite-acceptance page (`/invite/accept?token=...`).
 *
 * Registered OUTSIDE AuthGuard in App.tsx: the invitee has no account and no
 * token yet, so a guarded route would bounce them to /login — where "sign up"
 * silently creates a brand-new organization + kitchen instead of joining the
 * kitchen that invited them (T042 audit, finding F1).
 *
 * There is no mailer in this project, so the Owner copies the link from
 * TeamPage and sends it out-of-band; this page is the other half of that flow.
 */
export function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') ?? '').trim();

  // Read once at mount: whoever (if anyone) is currently signed in on this
  // browser. Accepting replaces that session, so say so rather than switching
  // tenants silently — that confusion is exactly what this task removes.
  const [currentUser] = useState(() => getUser());

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    // Client-side mirror of the API's @MinLength(8). Blocked here means zero
    // network calls.
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await acceptInvite(token, password);
      setToken(data.accessToken);
      setUser({ ...data.user, themePreference: apiThemeToId(data.user.themePreference) });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // Backend messages are surfaced as-is: 404 "Invite not found or already
      // used" (unknown / used / revoked / expired — deliberately collapsed)
      // and 409 "An account already exists for this email".
      setError(err instanceof Error ? err.message : 'Could not accept this invite.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm bg-surface-raised p-8 rounded-lg shadow">
        <h1 className="text-2xl font-semibold mb-2 text-center">KitchenOS</h1>
        <h2 className="text-sm text-muted mb-6 text-center">Accept your invitation</h2>

        {!token ? (
          <p className="text-danger text-sm" data-testid="missing-token">
            This invite link is missing its token. Ask whoever invited you to send you the full
            link again.
          </p>
        ) : (
          <>
            {currentUser && (
              <p className="text-warning text-sm mb-4 break-words" data-testid="signed-in-notice">
                You are signed in as {currentUser.email}. Accepting this invitation will sign you
                out of that account and sign you in as the invited user.
              </p>
            )}
            <form className="flex flex-col gap-3" onSubmit={submit}>
              <input
                className="border rounded px-3 py-2"
                type="password"
                placeholder="Password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <input
                className="border rounded px-3 py-2"
                type="password"
                placeholder="Confirm password"
                aria-label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
              <button
                type="submit"
                className="bg-accent text-white rounded py-2 min-h-[44px] disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Please wait...' : 'Accept invitation'}
              </button>
            </form>
          </>
        )}

        {error && (
          <p className="text-danger mt-4 text-sm break-words" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
