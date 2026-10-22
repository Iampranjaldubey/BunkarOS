import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Store } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useT } from '../i18n';
import { Avatar } from '../features/workers/shared';
import { WorkerShell } from './WorkerShell';
import { claimByCode, fetchShop, getWorkerToken, setWorkerToken } from './api';

type Shop = { unitName: string; workers: { workerId: string; name: string; jobTitle: string }[] };

/** Fallback for workers without the WhatsApp link: shop code → pick name → 4-digit code. Three big steps. */
export default function WorkerJoinPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [shopCode, setShopCode] = useState('');
  const [shop, setShop] = useState<Shop | null>(null);
  const [workerId, setWorkerId] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (getWorkerToken()) navigate('/w', { replace: true }); }, [navigate]);

  const lookup = async (value: string) => {
    setErr(''); setBusy(true);
    try { const s = await fetchShop(value); if (!s) { setErr(t('wj.wrongShop')); return; } setShop(s); }
    finally { setBusy(false); }
  };
  const open = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await claimByCode(shopCode, workerId, code);
      if (!r.ok) { setErr(r.status === 401 ? t('wj.wrongCode') : t('wp.error')); setCode(''); return; }
      setWorkerToken(r.token); navigate('/w', { replace: true });
    } finally { setBusy(false); }
  };
  const step = !shop ? 1 : !workerId ? 2 : 3;
  const picked = shop?.workers.find((w) => w.workerId === workerId);

  return (
    <WorkerShell header={<div><p className="text-sm text-muted">{t('app.name')}</p><h1 className="text-2xl">{t('wj.title')}</h1></div>}>
      <div className="mb-4 flex items-center gap-2" aria-hidden="true">{[1, 2, 3].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-primary' : 'bg-line'}`} />)}</div>
      {step === 1 && (
        <Card className="md:p-6">
          <div className="mb-4 flex items-center gap-3"><span className="rounded-2xl bg-primary-soft p-3 text-primary"><Store aria-hidden="true" size={28} /></span><p className="text-base text-ink">{t('wj.hint')}</p></div>
          <label htmlFor="shop-code" className="mb-1.5 block text-sm font-medium text-muted">{t('wj.shopCode')}</label>
          <Input id="shop-code" inputMode="numeric" maxLength={6} autoFocus value={shopCode} aria-invalid={Boolean(err) || undefined}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setShopCode(v); setErr(''); if (v.length === 6) void lookup(v); }}
            className="num min-h-16 text-center text-3xl tracking-[0.4em]" />
          {err && <p role="alert" className="mt-2 text-base font-medium text-given">{err}</p>}
          <Button block size="xl" className="mt-4" disabled={shopCode.length < 6 || busy} onClick={() => void lookup(shopCode)}>{t('wj.next')}</Button>
          <p className="mt-4 text-center text-sm text-muted">{t('wj.haveLink')}</p>
        </Card>
      )}
      {step === 2 && shop && (
        <Card className="md:p-6">
          <p className="mb-1 text-sm text-muted">{t('wp.shop')}: <span className="font-medium text-ink">{shop.unitName}</span></p>
          <h2 className="mb-3 text-xl">{t('wj.pick')}</h2>
          {shop.workers.length === 0 ? <p className="text-muted">{t('wj.noWorkers')}</p> : (
            <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {shop.workers.map((w) => (
                <li key={w.workerId}><button type="button" onClick={() => setWorkerId(w.workerId)} className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-3 text-center hover:bg-surface-2 focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink">
                  <Avatar name={w.name} size={44} /><span className="font-medium text-ink">{w.name}</span><span className="text-xs text-muted">{t(`worker.job.${w.jobTitle}`)}</span></button></li>
              ))}
            </ul>
          )}
          <Button variant="ghost" className="mt-3" onClick={() => { setShop(null); setShopCode(''); }}><ChevronLeft aria-hidden="true" size={18} />{t('wj.back')}</Button>
        </Card>
      )}
      {step === 3 && picked && (
        <Card className="md:p-6">
          <div className="mb-4 flex items-center gap-3"><Avatar name={picked.name} size={48} /><div><p className="text-lg font-medium text-ink">{picked.name}</p><p className="text-sm text-muted">{shop?.unitName}</p></div></div>
          <label htmlFor="worker-code" className="mb-1.5 block text-sm font-medium text-muted">{t('wj.code')}</label>
          <Input id="worker-code" type="password" inputMode="numeric" maxLength={4} autoFocus value={code} aria-invalid={Boolean(err) || undefined} aria-describedby="worker-code-hint"
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setErr(''); }} className="num min-h-16 text-center text-3xl tracking-[0.6em]" />
          <p id="worker-code-hint" className="mt-1 text-sm text-muted">{t('wj.codeHint')}</p>
          {err && <p role="alert" className="mt-2 text-base font-medium text-given">{err}</p>}
          <Button block size="xl" className="mt-4" disabled={code.length < 4 || busy} onClick={() => void open()}>{t('wj.open')}</Button>
          <Button variant="ghost" className="mt-2" onClick={() => { setWorkerId(''); setCode(''); setErr(''); }}><ChevronLeft aria-hidden="true" size={18} />{t('wj.back')}</Button>
        </Card>
      )}
    </WorkerShell>
  );
}
