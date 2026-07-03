import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthGuard } from './AuthGuard';
import { setToken } from './auth';

function Protected() {
  return <div>protected content</div>;
}

function Login() {
  return <div>login page</div>;
}

function renderGuardAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AuthGuard />}>
          <Route path="/tasks" element={<Protected />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthGuard', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('redirects to /login when there is no token', () => {
    renderGuardAt('/tasks');
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders the protected route when a token is present', () => {
    setToken('fake-jwt');
    renderGuardAt('/tasks');
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });
});
