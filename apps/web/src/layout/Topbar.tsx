import { useNavigate } from 'react-router-dom';
import { clearToken } from '../routes/auth';
import { NotificationBell } from '../components/NotificationBell/NotificationBell';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const navigate = useNavigate();

  const logout = () => {
    clearToken();
    navigate('/login', { replace: true });
  };

  return (
    <header className="flex items-center justify-between border-b bg-surface-raised px-4 py-3">
      <button
        type="button"
        aria-label="Toggle navigation menu"
        className="md:hidden rounded border px-3 py-1.5 text-sm"
        onClick={onMenuClick}
      >
        Menu
      </button>
      <span className="font-semibold">KitchenOS</span>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <button type="button" className="text-sm text-muted hover:text-primary" onClick={logout}>
          Log out
        </button>
      </div>
    </header>
  );
}
