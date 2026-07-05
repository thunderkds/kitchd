import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthResponseDto } from '@kitchenos/shared';
import { setToken, setUser } from '../auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

type Mode = 'login' | 'signup';

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
      setUser(data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-semibold mb-6 text-center">KitchenOS</h1>
        <div className="flex mb-6 rounded overflow-hidden border">
          <button
            type="button"
            className={`flex-1 py-2 ${mode === 'signup' ? 'bg-purple-600 text-white' : 'bg-white'}`}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
          <button
            type="button"
            className={`flex-1 py-2 ${mode === 'login' ? 'bg-purple-600 text-white' : 'bg-white'}`}
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
            className="bg-purple-600 text-white rounded py-2 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Please wait...' : mode === 'signup' ? 'Sign up' : 'Log in'}
          </button>
        </form>
        {error && <p className="text-red-600 mt-4 text-sm">{error}</p>}
        {result && (
          <p className="text-green-600 mt-4 text-sm break-all">
            Signed in as {result.user.email}. Token: {result.accessToken.slice(0, 24)}...
          </p>
        )}
      </div>
    </div>
  );
}
