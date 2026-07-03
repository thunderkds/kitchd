import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** App shell every gated feature screen renders inside: sidebar + topbar + content outlet. */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setMenuOpen((v) => !v)} />
        <main className="flex-1 p-4 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
