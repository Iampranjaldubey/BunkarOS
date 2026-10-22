import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { clearAdmin, getAdmin } from './api';

/** Internal admin chrome (English): brand, who is signed in, log out. */
export function AdminShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const admin = getAdmin();
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 lg:px-8">
          <Link to="/admin" className="flex items-center gap-2 font-medium text-ink"><span className="rounded-xl bg-primary p-1.5 text-white"><ShieldCheck aria-hidden="true" size={18} /></span>Bunkar Admin</Link>
          {title && <span className="truncate text-muted">/ {title}</span>}
          <span className="ml-auto text-sm text-muted">{admin?.name}</span>
          {admin && <Button size="md" variant="ghost" onClick={() => { clearAdmin(); navigate('/admin', { replace: true }); }}><LogOut aria-hidden="true" size={16} />Log out</Button>}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 lg:px-8">{children}</main>
    </div>
  );
}
