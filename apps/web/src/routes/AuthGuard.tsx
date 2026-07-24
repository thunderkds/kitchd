import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from './auth';

/**
 * Wraps gated routes. Redirects to /login when there is no auth token.
 * Client-side check only — the server remains the real authority on any API call.
 */
export function AuthGuard() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
