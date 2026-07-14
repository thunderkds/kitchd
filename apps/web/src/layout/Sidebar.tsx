import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navigation';

interface SidebarProps {
  open: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  return (
    <nav
      aria-label="Main navigation"
      className={`${open ? 'block' : 'hidden'} md:block w-full md:w-56 shrink-0 border-r bg-surface-raised md:min-h-screen`}
    >
      <ul className="flex flex-col p-2 gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-accent text-white' : 'text-primary hover:bg-surface'
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
