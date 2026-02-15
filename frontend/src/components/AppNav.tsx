import { NavLink } from 'react-router-dom';
import { Camera, House, History, Leaf } from 'lucide-react';

const baseLinkClass =
  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition';

export default function AppNav() {
  return (
    <header className="sticky top-0 z-20 h-16 border-b border-white/60 bg-white/70 backdrop-blur-md">
      <nav className="app-shell flex h-full items-center justify-between">
        <NavLink to="/" className="hero-title inline-flex items-center gap-2 text-2xl text-[var(--ink-900)]">
          <Leaf className="h-5 w-5 text-[var(--brand-600)]" />
          <span>SlopScan</span>
        </NavLink>

        <div className="flex items-center gap-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `${baseLinkClass} ${isActive ? 'border-green-300 bg-green-50 text-green-900' : 'border-[var(--line-soft)] bg-white/80 text-[var(--ink-700)]'}`
            }
          >
            <House className="h-4 w-4" />
            Start
          </NavLink>
          <NavLink
            to="/scan"
            className={({ isActive }) =>
              `${baseLinkClass} ${isActive ? 'border-green-300 bg-green-50 text-green-900' : 'border-[var(--line-soft)] bg-white/80 text-[var(--ink-700)]'}`
            }
          >
            <Camera className="h-4 w-4" />
            Camera
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `${baseLinkClass} ${isActive ? 'border-green-300 bg-green-50 text-green-900' : 'border-[var(--line-soft)] bg-white/80 text-[var(--ink-700)]'}`
            }
          >
            <History className="h-4 w-4" />
            History
          </NavLink>
        </div>
      </nav>
    </header>
  );
}
