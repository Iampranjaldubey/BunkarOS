// SPEC-M13 settings cards: wage rules (D-001, D-002, D-003) and operator toggles (D-005). Owner edits; operators see them read-only.
// The parent keys each card by the current rules, so a new setting version starts the card fresh.
import { useMemo, useState } from 'react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { addRecord } from '../../db/repo';
import type { OffDayPolicy, OperatorPerms, SettingP, SlipSection, WagePaymentP } from '../../db/types';
import { FIXED_SLIP_SECTIONS, OFF_DAY_POLICIES, SHOWN_OPERATOR_TOGGLES, SLIP_SECTIONS, unitRules } from '../../domain/settings';
import { paidView } from '../../domain/wage';
import { formatMonth } from '../../domain/dates';
import { monthOf, todayIST } from '../../domain/ids';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';
import { slipContent } from '../wages/lines';
import { SlipPaper } from '../wages/SlipPaper';

function Switch({ checked, onChange, label, disabled, testid }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; testid?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} data-testid={testid}
      className={cn('relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50', checked ? 'border-primary bg-primary' : 'border-line bg-surface-2')}>
      <span aria-hidden="true" className={cn('inline-block h-6 w-6 rounded-full bg-surface shadow-card transition-transform', checked ? 'translate-x-7' : 'translate-x-1')} />
    </button>
  );
}

/** Example A (docs/wage-examples.md) as a stored payment, for the slip preview. */
function samplePayment(overtime: boolean): WagePaymentP {
  const ot = overtime ? 17_400 : 0;
  const net = 1_084_615 + ot - 100_000;
  return {
    workerId: 'sample', month: monthOf(todayIST()), grossPaise: 1_084_615, otPaise: ot, deductions: [], advanceRecoveredPaise: 100_000,
    netPaise: net, roundingPaise: -15, paidPaise: net - 15, mode: 'cash',
    snapshot: { present: 23, half: 1, absent: 2, otHours: overtime ? 3 : 0, pieces: 0, payType: 'monthly', ratePaise: 1_200_000, workingDays: 26, perDayPaise: 46_154,
      absentDeductPaise: 92_308, halfDeductPaise: 23_077, otRatePaise: 5_800, advanceOutstandingPaise: 100_000,
      parts: { base: 1_200_000, absent_deduct: 92_308, half_deduct: 23_077, overtime: ot, advance_recovered: 100_000, rounding: -15 } },
  };
}

export function WageRulesCard({ settings, isOwner }: { settings: SettingP; isOwner: boolean }) {
  const { t, lang } = useT();
  const toast = useToast();
  const current = useMemo(() => unitRules(settings), [settings]);
  const [overtime, setOvertime] = useState(current.overtimeEnabled);
  const [policy, setPolicy] = useState<OffDayPolicy>(current.offDayPolicy);
  const [slip, setSlip] = useState<Record<SlipSection, boolean>>(current.slip);
  const dirty = overtime !== current.overtimeEnabled || policy !== current.offDayPolicy || SLIP_SECTIONS.some((k) => slip[k] !== current.slip[k]);

  const effectiveSlip = { ...slip, overtime: overtime && slip.overtime };
  const preview = slipContent({
    view: paidView(samplePayment(overtime)), sections: effectiveSlip, t, overtimeEnabled: overtime,
    business: settings.unitName, worker: 'Rafiq', month: formatMonth(monthOf(todayIST()), lang), mode: 'cash', payDayText: formatMonth(monthOf(todayIST()), lang),
  });

  const save = async () => {
    await addRecord<SettingP>('setting', { ...settings, overtimeEnabled: overtime, offDayPolicy: policy, slipSections: effectiveSlip });
    toast.show(t('settings.saved'), 'success');
  };

  return (
    <Card className="mb-4 lg:col-span-2 lg:mb-0" data-testid="rules-card">
      <CardTitle>{t('settings.rules')}</CardTitle>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div><p className="font-medium text-ink">{t('settings.overtime')}</p><p className="text-sm text-muted">{t('settings.overtimeHint')}</p></div>
            <div className="flex items-center gap-2"><span className="text-sm text-muted" aria-hidden="true">{overtime ? t('settings.on') : t('settings.off')}</span>
              <Switch checked={overtime} onChange={setOvertime} label={t('settings.overtime')} disabled={!isOwner} testid="overtime-switch" /></div>
          </div>
          <fieldset className="mb-5">
            <legend className="mb-2 font-medium text-ink">{t('settings.offDayPolicy')}</legend>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label={t('settings.offDayPolicy')}>
              {OFF_DAY_POLICIES.map((p) => (
                <label key={p} className={cn('flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3', policy === p ? 'border-primary bg-primary-soft' : 'border-line')}>
                  <input type="radio" name="offDayPolicy" value={p} checked={policy === p} disabled={!isOwner} onChange={() => setPolicy(p)} className="mt-1 h-5 w-5 accent-[var(--color-primary)]" />
                  <span><span className="block font-medium text-ink">{t(`settings.policy.${p}`)}</span><span className="block text-sm text-muted">{t(`settings.policy.${p}.ex`)}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-medium text-ink">{t('settings.slipSections')}</legend>
            <ul className="grid gap-1 sm:grid-cols-2" data-testid="slip-sections">
              {SLIP_SECTIONS.map((k) => {
                const fixed = FIXED_SLIP_SECTIONS.includes(k);
                const otOnly = k === 'overtime' && !overtime;
                return (
                  <li key={k}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                      <input type="checkbox" checked={fixed || (!otOnly && slip[k])} disabled={!isOwner || fixed || otOnly} onChange={(e) => setSlip({ ...slip, [k]: e.target.checked })} className="h-5 w-5 accent-[var(--color-primary)]" />
                      <span className="text-ink">{t(`slip.opt.${k}`)}{fixed && <span className="ml-1 text-xs text-muted">({t('settings.slipFixed')})</span>}{otOnly && <span className="ml-1 text-xs text-muted">({t('settings.overtimeOnlyWhenOn')})</span>}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          {isOwner && <Button className="mt-4" block disabled={!dirty} onClick={() => void save()} data-testid="save-rules">{t('settings.saveRules')}</Button>}
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-muted">{t('settings.slipPreview')}</p>
          {/* A4 at about 40 %: 210 × 297 mm → ~318 × 450 px */}
          <div className="relative h-[450px] w-[318px] max-w-full overflow-hidden rounded-xl border border-line bg-white shadow-card" aria-hidden="true">
            <div className="origin-top-left scale-[0.4]"><SlipPaper c={preview} testid="slip-preview" /></div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function OperatorsCard({ settings, isOwner }: { settings: SettingP; isOwner: boolean }) {
  const { t } = useT();
  const toast = useToast();
  const current = useMemo(() => unitRules(settings).operatorPerms, [settings]);
  const [perms, setPerms] = useState<OperatorPerms>(current);
  const dirty = SHOWN_OPERATOR_TOGGLES.some((k) => perms[k] !== current[k]);
  const save = async () => {
    // Stage 1: "see wages" is not a toggle yet; operators keep seeing wages (SPEC-M13 stage 2).
    const { addEntries, editPast, seePrices, export: exp } = perms;
    await addRecord<SettingP>('setting', { ...settings, operatorPerms: { addEntries, editPast, seePrices, export: exp } });
    toast.show(t('settings.saved'), 'success');
  };
  return (
    <Card className="mb-4 lg:mb-0" data-testid="operators-card">
      <CardTitle>{t('settings.operators')}</CardTitle>
      <p className="mb-3 text-sm text-muted">{t('settings.permsHint')}</p>
      <ul className="divide-y divide-line">
        {SHOWN_OPERATOR_TOGGLES.map((k) => (
          <li key={k} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0"><p className="font-medium text-ink">{t(`settings.perm.${k}`)}</p><p className="text-sm text-muted">{t(`settings.perm.${k}.hint`)}</p></div>
            <Switch checked={perms[k]} onChange={(v) => setPerms({ ...perms, [k]: v })} label={t(`settings.perm.${k}`)} disabled={!isOwner} testid={`perm-${k}`} />
          </li>
        ))}
      </ul>
      {isOwner && <Button className="mt-3" block disabled={!dirty} onClick={() => void save()} data-testid="save-perms">{t('settings.savePerms')}</Button>}
    </Card>
  );
}
