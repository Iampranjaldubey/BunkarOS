import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { adminLogin } from './api';

/** Founders' login: name + admin key from the server's ADMIN_KEYS. */
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
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-5">
      <div className="text-center"><span className="inline-block rounded-2xl bg-primary p-3 text-white"><ShieldCheck aria-hidden="true" size={28} /></span><h1 className="mt-3 text-3xl">Bunkar Admin</h1><p className="text-muted">Platform view for the founders</p></div>
      <Card>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="Name" required>{({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoFocus />}</Field>
          <Field label="Admin key" required error={err}>{({ id, describedBy, invalid }) => <Input id={id} type="password" value={key} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" />}</Field>
          <Button type="submit" size="xl" disabled={busy || !name.trim() || !key}>Sign in</Button>
        </form>
      </Card>
    </div>
  );
}
