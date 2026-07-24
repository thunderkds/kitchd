import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken, setUser, type StoredUser } from '../auth';
import { apiThemeToId } from '../../theme/themeMapping';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

type Mode = 'login' | 'signup';

// Mirrors the API's AuthResponseDto shape (see apps/api/src/auth/auth.service.ts
// buildAuthResult). Defined locally instead of importing @kitchenos/shared so
// apps/web has no workspace-package dependency and can be built/deployed as a
// fully standalone npm project (Render Root Directory: apps/web).
//
// `themePreference` on the wire is the backend's raw snake_case Theme enum
// value (e.g. "dark_neon") — StoredUser.themePreference is the frontend's
// kebab-case ThemeId, so `user` here is typed as the raw API shape and
// translated via apiThemeToId() before it's ever stored (T026 Edge Case
// Checklist: don't leak one casing convention into the other's context).
interface AuthResponseDto {
  accessToken: string;
  user: Omit<StoredUser, 'themePreference'> & { themePreference?: string | null };
}

export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [kitchenName, setKitchenName] = useState('');
  const [result, setResult] = useState<AuthResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const path = mode === 'signup' ? '/auth/signup' : '/auth/login';
      const body =
        mode === 'signup'
          ? { email, password, organizationName, kitchenName }
          : { email, password };
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? 'Request failed');
      }
      setResult(data);
      setToken(data.accessToken);
      setUser({ ...data.user, themePreference: apiThemeToId(data.user.themePreference) });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-full max-w-sm bg-surface-raised p-8 rounded-lg shadow">
        <h1 className="text-2xl font-semibold mb-6 text-center">KitchenOS</h1>
        <div className="flex mb-6 rounded overflow-hidden border">
          <button
            type="button"
            className={`flex-1 py-2 ${mode === 'signup' ? 'bg-accent text-white' : 'bg-surface-raised'}`}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
          <button
            type="button"
            className={`flex-1 py-2 ${mode === 'login' ? 'bg-accent text-white' : 'bg-surface-raised'}`}
            onClick={() => setMode('login')}
          >
            Log in
          </button>
        </div>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <input
            className="border rounded px-3 py-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="border rounded px-3 py-2"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {mode === 'signup' && (
            <>
              <input
                className="border rounded px-3 py-2"
                type="text"
                placeholder="Organization name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />
              <input
                className="border rounded px-3 py-2"
                type="text"
                placeholder="Kitchen name"
                value={kitchenName}
                onChange={(e) => setKitchenName(e.target.value)}
                required
              />
            </>
          )}
          <button
            type="submit"
            className="bg-accent text-white rounded py-2 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Please wait...' : mode === 'signup' ? 'Sign up' : 'Log in'}
          </button>
        </form>
        {error && <p className="text-danger mt-4 text-sm">{error}</p>}
        {result && (
          <p className="text-success mt-4 text-sm break-all">
            Signed in as {result.user.email}. Token: {result.accessToken.slice(0, 24)}...
          </p>
        )}
      </div>
    </div>
  );
}
