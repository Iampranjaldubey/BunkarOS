import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ShoppingBag, Ruler, Package, PackageOpen, Banknote, Smartphone,
  HandCoins, AlertTriangle, PauseCircle, MessageSquareWarning, RefreshCw, Send, Bell,
  ChevronRight, ChevronLeft, PackageX, CalendarRange,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PreviewShareSheet } from '../../components/ui/PreviewShareSheet';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { digest, digestTextHi, digestTextEn, getSettings, formatDay } from '../../domain/projections';
import { monthlySummary, monthLabel, monthlyTextHi, monthlyTextEn } from '../../domain/monthly';
import { istDay } from '../../domain/ids';
import { formatINR, gramsToKgStr, cn } from '../../lib/utils';
import { useT } from '../../i18n';

interface Row {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: 'given' | 'received' | 'warn' | 'neutral';
}

function DigestRow({ icon: Icon, label, value, tone = 'neutral' }: Row) {
  const toneText =
    tone === 'given' ? 'text-madder' : tone === 'received' ? 'text-ok' : tone === 'warn' ? 'text-saffron-ink' : 'text-ink';
  const toneBg =
    tone === 'given' ? 'bg-madder/10 text-madder' : tone === 'received' ? 'bg-ok/12 text-ok' : tone === 'warn' ? 'bg-saffron/20 text-saffron-ink' : 'bg-indigo/10 text-indigo';
  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <span aria-hidden="true" className={cn('flex h-10 w-10 items-center justify-center rounded-full', toneBg)}>
        <Icon size={20} />
      </span>
      <span className="flex-1 text-base text-ink">{label}</span>
      <span className={cn('num text-xl font-bold', toneText)}>{value}</span>
    </li>
  );
}

const REMINDER_KEY = 'bunkar.digestReminder';

export default function DigestPage() {
  const { t, lang } = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const recs = useRecords();
  const settings = getSettings(recs);

  const day = istDay(new Date().toISOString());
  const nowISO = new Date().toISOString();
  const d = useMemo(() => digest(recs, day, nowISO), [recs, day, nowISO]);
  const shareText = lang === 'en' ? digestTextEn(d) : digestTextHi(d);

  const [shareOpen, setShareOpen] = useState(false);
  const ownerPhone = settings?.ownerPhone ?? '';

  // ---- Monthly summary (SPEC-018) — prev/next month selector ----
  const thisMonth = day.slice(0, 7); // 'YYYY-MM'
  const [month, setMonth] = useState(thisMonth);
  const m = useMemo(() => monthlySummary(recs, month), [recs, month]);
  const monthShareText = lang === 'en' ? monthlyTextEn(m) : monthlyTextHi(m);
  const [monthShareOpen, setMonthShareOpen] = useState(false);
  // Do not let the owner page past the current month (no future data).
  const atCurrentMonth = month >= thisMonth;
  const shiftMonth = (delta: number) => {
    const [y, mo] = month.split('-').map(Number);
    const base = new Date(Date.UTC(y, mo - 1 + delta, 1));
    setMonth(`${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  // 8 PM reminder toggle.
  const [reminderOn, setReminderOn] = useState(() => localStorage.getItem(REMINDER_KEY) === '1');
  const timerRef = useRef<number | null>(null);

  const scheduleReminder = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const now = new Date();
    const target = new Date();
    target.setHours(20, 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    const ms = target.getTime() - now.getTime();
    // setTimeout caps at ~24.8 days; our window is < 24h so it is safe.
    timerRef.current = window.setTimeout(() => {
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(t('digest.reminderFired'));
        }
      } catch { /* ignore */ }
    }, ms);
  };

  useEffect(() => {
    if (reminderOn) scheduleReminder();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderOn]);

  const toggleReminder = async () => {
    if (reminderOn) {
      setReminderOn(false);
      localStorage.setItem(REMINDER_KEY, '0');
      return;
    }
    if (!('Notification' in window)) {
      toast.show(t('digest.reminderUnsupported'), 'error');
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; }
    }
    if (perm !== 'granted') {
      toast.show(t('digest.reminderDenied'), 'error');
      return;
    }
    setReminderOn(true);
    localStorage.setItem(REMINDER_KEY, '1');
    toast.show(t('digest.reminderOn'), 'success');
  };

  const hasAlerts = d.tauliShortCount > 0 || d.noWoolLoomCodes.length > 0 || d.idleLoomCodes.length > 0 || d.disputes > 0 || d.pendingSync > 0 || d.ordersAtRisk.length > 0;

  return (
    <section>
      <PageHeader title={t('digest.title')} back />

      <p className="mb-4 text-base text-muted">{t('digest.for', { day: formatDay(day, lang) })}</p>

      {/* Work */}
      <Card className="mb-4">
        <CardTitle>{t('digest.section.work')}</CardTitle>
        <ul>
          <DigestRow icon={ShoppingBag} label={t('digest.bazaars')} value={String(d.bazaarCount)} tone="neutral" />
          <DigestRow icon={Ruler} label={t('digest.bazaarArea')} value={`${d.bazaarSqft.toFixed(2)} ${t('common.ft')}²`} tone="neutral" />
          <DigestRow icon={Package} label={t('digest.woolIssued')} value={`${gramsToKgStr(d.woolIssuedG)} ${t('common.kg')}`} tone="given" />
          <DigestRow icon={PackageOpen} label={t('digest.woolOutside')} value={`${gramsToKgStr(d.woolOutsideG)} ${t('common.kg')}`} tone="given" />
        </ul>
      </Card>

      {/* Money */}
      <Card className="mb-4">
        <CardTitle>{t('digest.section.money')}</CardTitle>
        <ul>
          <DigestRow icon={Banknote} label={t('digest.cashPaid')} value={formatINR(d.cashPaidPaise)} tone="given" />
          <DigestRow icon={Smartphone} label={t('digest.upiPaid')} value={formatINR(d.upiPaidPaise)} tone="given" />
          <DigestRow icon={HandCoins} label={t('digest.peshgiGiven')} value={formatINR(d.peshgiGivenPaise)} tone="given" />
        </ul>
      </Card>

      {/* Monthly summary (SPEC-018) — इस महीने */}
      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <CardTitle className="mb-0 flex items-center gap-2">
            <CalendarRange aria-hidden="true" size={20} className="text-indigo" />
            {t('month.title')}
          </CardTitle>
          <div className="flex items-center gap-1" role="group" aria-label={t('month.title')}>
            <button
              type="button"
              aria-label={t('month.prev')}
              data-testid="month-prev"
              onClick={() => shiftMonth(-1)}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
            >
              <ChevronLeft aria-hidden="true" size={22} />
            </button>
            <span className="min-w-[8rem] text-center text-base font-bold text-ink" data-testid="month-label">
              {monthLabel(month, lang)}
            </span>
            <button
              type="button"
              aria-label={t('month.next')}
              data-testid="month-next"
              onClick={() => shiftMonth(1)}
              disabled={atCurrentMonth}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink disabled:opacity-40"
            >
              <ChevronRight aria-hidden="true" size={22} />
            </button>
          </div>
        </div>

        <ul data-testid="month-summary">
          <DigestRow icon={ShoppingBag} label={t('month.bazaars')} value={String(m.bazaarCount)} tone="neutral" />
          <DigestRow icon={Ruler} label={t('month.sqft')} value={`${m.sqftWoven.toFixed(2)} ${t('common.ft')}²`} tone="neutral" />
          <DigestRow icon={Banknote} label={t('month.wageBill')} value={formatINR(m.wageBillPaise, { paise: true })} tone="neutral" />
          <DigestRow icon={HandCoins} label={t('month.paid')} value={formatINR(m.paidPaise, { paise: true })} tone="given" />
          <DigestRow icon={HandCoins} label={t('month.peshgiGiven')} value={formatINR(m.peshgiGivenPaise)} tone="given" />
          <DigestRow icon={HandCoins} label={t('month.peshgiRecovered')} value={formatINR(m.peshgiRecoveredPaise)} tone="received" />
          <DigestRow icon={Package} label={t('month.woolUsed')} value={`${gramsToKgStr(m.woolUsedG)} ${t('common.kg')}`} tone="given" />
          <DigestRow icon={PackageX} label={t('month.woolShort')} value={`${gramsToKgStr(m.woolShortG)} ${t('common.kg')}`} tone="given" />
          <DigestRow
            icon={AlertTriangle}
            label={t('month.yarnLoss')}
            value={m.yarnLossPct === null ? '—' : `${m.yarnLossPct.toFixed(1)}%`}
            tone="warn"
          />
          {/* Rejects — not tracked yet (SPEC-018 Scope-Out), shown as a labelled em-dash line. */}
          <li className="flex items-center gap-3 border-b border-line py-3 last:border-0" data-testid="month-rejects">
            <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo/10 text-indigo">
              <MessageSquareWarning size={20} />
            </span>
            <span className="flex-1 text-base text-ink">{t('month.rejects')}</span>
            <span className="num text-base text-muted">— ({t('month.rejectsNote')})</span>
          </li>
        </ul>

        {ownerPhone ? (
          <Button block variant="secondary" size="xl" className="mt-3" data-testid="month-share" onClick={() => setMonthShareOpen(true)}>
            <Send aria-hidden="true" />
            {t('month.share')}
          </Button>
        ) : (
          <p className="mt-3 rounded-2xl border border-saffron/40 bg-saffron/15 p-4 text-center text-base text-saffron-ink">
            {t('digest.noPhone')}
          </p>
        )}

        <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-line bg-surface p-3 text-sm text-muted" data-testid="month-share-text">
          {monthShareText}
        </p>
      </Card>

      {/* Alerts */}
      {hasAlerts && (
        <Card className="mb-4">
          <CardTitle>{t('digest.section.alerts')}</CardTitle>
          <ul>
            {d.tauliShortCount > 0 && (
              <DigestRow
                icon={AlertTriangle}
                label={t('digest.tauliShort')}
                value={d.tauliShortLoomCodes.length ? d.tauliShortLoomCodes.join(', ') : String(d.tauliShortCount)}
                tone="warn"
              />
            )}
            {d.noWoolLoomCodes.length > 0 && (
              <DigestRow
                icon={PackageX}
                label={t('digest.noWoolLooms')}
                value={d.noWoolLoomCodes.join(', ')}
                tone="given"
              />
            )}
            {d.idleLoomCodes.length > 0 && (
              <DigestRow icon={PauseCircle} label={t('digest.idleLooms')} value={d.idleLoomCodes.join(', ')} tone="warn" />
            )}
            {d.disputes > 0 && (
              <DigestRow icon={MessageSquareWarning} label={t('digest.disputes')} value={String(d.disputes)} tone="given" />
            )}
            {d.pendingSync > 0 && (
              <DigestRow icon={RefreshCw} label={t('digest.pendingSync')} value={String(d.pendingSync)} tone="warn" />
            )}
          </ul>

          {/* Orders at risk — tappable order numbers with reason chips */}
          {d.ordersAtRisk.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <h3 className="mb-2 text-base font-medium text-ink">{t('digest.ordersAtRisk')}</h3>
              <ul className="flex flex-col gap-2">
                {d.ordersAtRisk.map((o) => (
                  <li key={o.orderId}>
                    <button
                      type="button"
                      data-testid="digest-risk-order"
                      onClick={() => navigate(`/orders/${o.orderId}`)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
                    >
                      <span className="num text-lg font-bold text-ink">{o.orderNo}</span>
                      <span className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        o.reason === 'overdue' ? 'bg-madder/15 text-madder'
                          : o.reason === 'due_soon' ? 'bg-saffron/20 text-saffron-ink'
                            : 'bg-indigo/10 text-indigo',
                      )}>
                        {t(`risk.reason.${o.reason}`)}
                      </span>
                      <span className="flex-1 text-right text-sm text-muted">{t('risk.openPieces', { n: o.openPieces })}</span>
                      <ChevronRight aria-hidden="true" className="text-muted" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* 8 PM reminder */}
      <Card className="mb-4 flex items-center gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-saffron/20 text-saffron-ink">
          <Bell size={20} />
        </span>
        <span className="flex-1">
          <span className="block text-base font-medium text-ink">{t('digest.reminder')}</span>
          <span className="block text-sm text-muted">{t('digest.reminderHint')}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={reminderOn}
          aria-label={t('digest.reminder')}
          onClick={() => void toggleReminder()}
          className="relative flex h-12 w-16 shrink-0 items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
        >
          <span
            aria-hidden="true"
            className={cn(
              'relative h-8 w-14 rounded-full transition-colors',
              reminderOn ? 'bg-ok' : 'bg-line',
            )}
          >
            <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', reminderOn ? 'left-7' : 'left-1')} />
          </span>
        </button>
      </Card>

      {/* Share */}
      {ownerPhone ? (
        <Button block size="xl" data-testid="digest-share" onClick={() => setShareOpen(true)}>
          <Send aria-hidden="true" />
          {t('digest.share')}
        </Button>
      ) : (
        <p className="rounded-2xl border border-saffron/40 bg-saffron/15 p-4 text-center text-base text-saffron-ink">
          {t('digest.noPhone')}
        </p>
      )}

      <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-line bg-surface p-3 text-sm text-muted">
        {shareText}
      </p>

      <PreviewShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        recipientName={t('role.owner')}
        phone={ownerPhone}
        text={shareText}
      />

      <PreviewShareSheet
        open={monthShareOpen}
        onClose={() => setMonthShareOpen(false)}
        recipientName={t('role.owner')}
        phone={ownerPhone}
        text={monthShareText}
      />
    </section>
  );
}
