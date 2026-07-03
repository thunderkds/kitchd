import { useNavigate } from 'react-router-dom';
import { clearToken } from '../routes/auth';

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
    <header className="flex items-center justify-between border-b bg-white px-4 py-3">
      <button
        type="button"
        aria-label="Toggle navigation menu"
        className="md:hidden rounded border px-3 py-1.5 text-sm"
        onClick={onMenuClick}
      >
        Menu
      </button>
      <span className="font-semibold">KitchenOS</span>
      <button type="button" className="text-sm text-gray-600 hover:text-gray-900" onClick={logout}>
        Log out
      </button>
    </header>
  );
}
