import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { BrandMark } from '../components/carpet/Carpet';
import { cn } from '../lib/utils';
import { clearAdmin, getAdmin } from './api';

const NAV = [
  { to: '/admin', label: 'Organisations', end: true },
  { to: '/admin/industries', label: 'Industry packs', end: false },
];

/** Founders' console chrome (English, desktop-first): brand, sections, who is signed in, log out. */
export function AdminShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const admin = getAdmin();
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 lg:px-8">
          <Link to="/admin" className="flex min-h-12 items-center gap-2 lg:min-h-11 font-display text-lg font-medium text-ink"><BrandMark size={28} />Bunkar platform</Link>
          {admin && (
            <nav aria-label="Console" className="flex items-center gap-1">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('relative inline-flex min-h-12 items-center rounded-xl px-3 text-base transition-colors lg:min-h-11', isActive ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:bg-surface-2/70 hover:text-ink')}>{n.label}</NavLink>
              ))}
            </nav>
          )}
          {title && <span className="truncate text-muted">/ {title}</span>}
          <span className="ml-auto text-sm text-muted">{admin?.name}</span>
          {admin && <Button size="md" variant="ghost" onClick={() => { clearAdmin(); navigate('/admin', { replace: true }); }}><LogOut aria-hidden="true" size={16} />Log out</Button>}
        </div>
      </header>
      <main className="rise-in mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
