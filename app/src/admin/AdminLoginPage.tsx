import { useState } from 'react';
import { Building2, Layers, ToggleRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { BrandMark } from '../components/carpet/Carpet';
import { adminLogin } from './api';

/**
 * Founders' login (English): name + admin key from the server's ADMIN_KEYS. Deliberately not the unit login:
 * no industry art, no PIN pad, so nobody mistakes the platform console for one organisation's app.
 */
export function AdminLoginPage({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState(''); const [key, setKey] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await adminLogin(name.trim(), key);
      if (r.ok) { onDone(); return; }
      setErr(r.status === 403 ? 'Admin access is not enabled on this server (set ADMIN_KEYS).' : r.status === 429 ? 'Too many attempts. Wait a minute.' : 'Wrong name or key.');
    } finally { setBusy(false); }
  };
  const points = [
    { icon: Building2, text: 'Create organisations for any industry and invite their owners' },
    { icon: ToggleRight, text: 'Turn modules on or off, pause or resume an organisation' },
    { icon: Layers, text: 'See each organisation’s use, never its business data' },
  ];
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)]">
      <aside className="hidden border-r border-line bg-surface-2 p-12 lg:flex lg:flex-col lg:justify-between">
        <span className="flex items-center gap-3 font-display text-xl font-medium text-ink"><BrandMark size={36} />Bunkar platform</span>
        <div className="max-w-md">
          <h2 className="mb-5 font-display text-3xl font-medium leading-tight text-ink">Founders’ console</h2>
          <ul className="flex flex-col gap-4">
            {points.map(({ icon: Icon, text }) => <li key={text} className="flex items-start gap-3 text-ink-2"><Icon aria-hidden="true" size={20} strokeWidth={1.6} className="mt-0.5 shrink-0 text-muted" />{text}</li>)}
          </ul>
        </div>
        <p className="text-sm text-muted">For the founders only. Organisation owners log in from their own app.</p>
      </aside>
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-5 px-5">
        <div className="text-center lg:text-left">
          <BrandMark size={48} className="mx-auto mb-3 lg:hidden" />
          <h1 className="text-3xl">Sign in to the console</h1>
          <p className="text-ink-2">Use your founder name and admin key.</p>
        </div>
        <Card>
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <Field label="Name" required>{({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoFocus />}</Field>
            <Field label="Admin key" required error={err}>{({ id, describedBy, invalid }) => <Input id={id} type="password" value={key} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" />}</Field>
            <Button type="submit" size="xl" disabled={busy || !name.trim() || !key}>Sign in</Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
