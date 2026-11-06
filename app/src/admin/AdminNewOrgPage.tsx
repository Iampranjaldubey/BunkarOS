import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Input, Select } from '../components/ui/Input';
import { Switch } from '../components/ui/Switch';
import { PreviewShareSheet } from '../components/ui/PreviewShareSheet';
import { useToast } from '../components/ui/Toast';
import { MODULES, effectiveModules } from '../domain/modules';
import { cn } from '../lib/utils';
import { AdminShell } from './AdminShell';
import { AdminLoginPage } from './AdminLoginPage';
import { createOrg, fetchIndustries, getAdmin, groupCode, inviteUrl, MODULE_LABEL, type Industry, type InviteSecrets, type ModuleMap } from './api';
import { INDUSTRY_LABEL, LANG_LABEL } from './labels';

const STEPS = ['Business', 'Modules', 'Owner and invite'];

/** The invite text the owner receives on WhatsApp (Hindi first; the owner's own language follows on the phone). */
const inviteText = (owner: string, unit: string, s: InviteSecrets) =>
  `नमस्ते ${owner} जी,\n${unit} के लिए आपकी यूनिट तैयार है। यह लिंक खोलें और अपना पिन बनाएँ:\n${inviteUrl(s.token)}\n\nया ऐप में यह कोड भरें: ${groupCode(s.code)}\n(7 दिन तक चलेगा)`;

/** /admin/new — create an organisation in three steps and send the owner the invite (SPEC-M18 §4, §7). */
export default function AdminNewOrgPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [authed, setAuthed] = useState(() => Boolean(getAdmin()));
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(''); const [industry, setIndustry] = useState('carpet'); const [lang, setLang] = useState('hi');
  const [modules, setModules] = useState<ModuleMap | null>(null);
  const [ownerName, setOwnerName] = useState(''); const [ownerPhone, setOwnerPhone] = useState(''); const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [done, setDone] = useState<{ unitId: string; invite: InviteSecrets } | null>(null);
  const [share, setShare] = useState(false);

  useEffect(() => { if (authed) void fetchIndustries().then((d) => { if (d) setIndustries(d.industries); else setAuthed(Boolean(getAdmin())); }); }, [authed]);
  const defaults = useMemo(() => industries.find((i) => i.id === industry)?.defaultModules, [industries, industry]);
  const mods = modules ?? effectiveModules(defaults);
  if (!authed) return <AdminLoginPage onDone={() => setAuthed(true)} />;

  const next = () => {
    const e: Record<string, string> = {};
    if (step === 0 && !name.trim()) e.name = 'Write the business name.';
    setErrors(e);
    if (!Object.keys(e).length) setStep(step + 1);
  };
  const create = async () => {
    const e: Record<string, string> = {};
    if (!ownerName.trim()) e.ownerName = "Write the owner's name.";
    if (!/^\+?\d{10,13}$/.test(ownerPhone.replace(/[\s-]/g, ''))) e.ownerPhone = 'Write a 10-digit mobile number.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true); setErr('');
    try {
      const r = await createOrg({ name: name.trim(), industry, modules: mods, lang, ownerName: ownerName.trim(), ownerPhone: ownerPhone.replace(/[\s-]/g, ''), reason: note.trim() || undefined });
      if (!r.ok) { setErr(r.error); return; }
      setDone({ unitId: r.data.unitId, invite: r.data.invite });
    } finally { setBusy(false); }
  };
  const toggle = (m: keyof ModuleMap, v: boolean) => setModules(effectiveModules({ ...mods, [m]: v, ...(m === 'wages' && v ? { attendance: true } : {}) }));
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.show('Copied', 'success'); } catch { /* ignore */ } };

  if (done) {
    return (
      <AdminShell>
        <Card className="mx-auto max-w-2xl" data-testid="invite-ready">
          <p className="mb-1 flex items-center gap-2 text-sm text-received"><Check aria-hidden="true" size={16} />Created</p>
          <h1 className="mb-1 text-2xl">{name}</h1>
          <p className="mb-5 text-ink-2">Send {ownerName} the link or the code. It works once and for 7 days.</p>
          <div className="mb-3 rounded-xl border border-line bg-surface-2/60 p-3">
            <p className="text-sm text-muted">Invite link</p>
            <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate font-mono text-sm text-ink" data-testid="invite-link">{inviteUrl(done.invite.token)}</p>
              <button type="button" onClick={() => void copy(inviteUrl(done.invite.token))} aria-label="Copy link" className="tap-48 inline-flex items-center justify-center rounded-xl text-ink-2 hover:bg-surface"><Copy aria-hidden="true" size={18} /></button></div>
          </div>
          <div className="mb-5 rounded-xl border border-line bg-surface-2/60 p-3">
            <p className="text-sm text-muted">Code</p>
            <div className="flex items-center gap-2"><p className="num flex-1 font-display text-3xl font-medium tracking-[0.15em] text-ink" data-testid="invite-code-shown">{groupCode(done.invite.code)}</p>
              <button type="button" onClick={() => void copy(groupCode(done.invite.code))} aria-label="Copy code" className="tap-48 inline-flex items-center justify-center rounded-xl text-ink-2 hover:bg-surface"><Copy aria-hidden="true" size={18} /></button></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShare(true)}><MessageCircle aria-hidden="true" size={18} />Send on WhatsApp</Button>
            <Button variant="secondary" onClick={() => navigate(`/admin/units/${done.unitId}`)}>Open organisation</Button>
          </div>
        </Card>
        <PreviewShareSheet open={share} onClose={() => setShare(false)} recipientName={ownerName} phone={ownerPhone} text={inviteText(ownerName, name, done.invite)} />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-5 text-3xl">New organisation</h1>
        <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined} className="flex flex-col gap-1.5">
              <span aria-hidden="true" className={cn('h-1.5 rounded-[2px] transition-colors duration-300', i <= step ? 'bg-primary' : 'bg-line-strong/60')} />
              <span className={cn('text-sm', i === step ? 'font-medium text-ink' : 'text-muted')}>{i + 1}. {s}</span>
            </li>
          ))}
        </ol>
        <Card>
          {step === 0 && (
            <div data-testid="step-business">
              <Field label="Business name" required error={errors.name}>{({ id, describedBy, invalid }) => <Input id={id} value={name} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
              <div className="md:grid md:grid-cols-2 md:gap-x-4">
                <Field label="Industry" hint="Sets the words, job titles, materials and the drawn products.">{({ id, describedBy }) => <Select id={id} aria-describedby={describedBy} value={industry} onChange={(e) => { setIndustry(e.target.value); setModules(null); }}>{(industries.length ? industries : [{ id: 'carpet', name: 'Carpet' }, { id: 'bags', name: 'Bags' }]).map((i) => <option key={i.id} value={i.id}>{INDUSTRY_LABEL[i.id] ?? i.name}</option>)}</Select>}</Field>
                <Field label="Owner's language" hint="The app starts in this language; the owner can change it.">{({ id, describedBy }) => <Select id={id} aria-describedby={describedBy} value={lang} onChange={(e) => setLang(e.target.value)}>{Object.entries(LANG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
              </div>
            </div>
          )}
          {step === 1 && (
            <div data-testid="step-modules">
              <CardTitle className="mb-1">Modules for {INDUSTRY_LABEL[industry] ?? industry}</CardTitle>
              <p className="mb-3 text-sm text-muted">Prefilled from the industry. Change any of them now or later.</p>
              <ul className="divide-y divide-line">
                {MODULES.map((m) => (
                  <li key={m} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0"><p className="font-medium text-ink">{MODULE_LABEL[m].name}</p><p className="text-sm text-muted">{MODULE_LABEL[m].hint}</p></div>
                    <Switch checked={mods[m]} onChange={(v) => toggle(m, v)} label={MODULE_LABEL[m].name} testid={`module-${m}`} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {step === 2 && (
            <div data-testid="step-owner">
              <div className="md:grid md:grid-cols-2 md:gap-x-4">
                <Field label="Owner's name" required error={errors.ownerName}>{({ id, describedBy, invalid }) => <Input id={id} value={ownerName} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setOwnerName(e.target.value)} autoFocus />}</Field>
                <Field label="Owner's mobile" required error={errors.ownerPhone}>{({ id, describedBy, invalid }) => <Input id={id} type="tel" inputMode="numeric" value={ownerPhone} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setOwnerPhone(e.target.value)} className="num" />}</Field>
              </div>
              <Field label="Note for the changes log" hint="Optional, e.g. how you met the owner.">{({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
              {err && <p role="alert" className="mb-3 text-base font-medium text-given">{err}</p>}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => (step === 0 ? navigate('/admin') : setStep(step - 1))}>{step === 0 ? 'Cancel' : 'Back'}</Button>
            {step < 2 ? <Button onClick={next} data-testid="wizard-next">Next</Button> : <Button onClick={() => void create()} disabled={busy} data-testid="wizard-create">Create and get invite</Button>}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
