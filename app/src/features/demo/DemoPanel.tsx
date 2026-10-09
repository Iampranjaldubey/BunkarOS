// Bunkar OS — demo data panel (owned by the demo feature folder).
// The Settings screen embeds <DemoPanel /> so owners can seed or clear a
// realistic unit. Self-contained: all strings via t('demo.*'); writes only
// through the seed module (which uses db directly for backdating).
import { useEffect, useState } from 'react';
import { Database, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmSheet } from '../../components/ui/Sheet';
import { StatTile } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { can } from '../../domain/permissions';
import { loadDemoData, clearUnitData, isDemoLoaded } from './seed';

export function DemoPanel() {
  const { t } = useT();
  const { role } = useSession();
  const toast = useToast();
  const [loaded, setLoaded] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<'load' | 'clear' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // settings.edit is the closest owner-only gate for destructive demo actions.
  const mayManage = role ? can(role, 'settings.edit') : false;

  useEffect(() => {
    let alive = true;
    void isDemoLoaded().then((v) => {
      if (alive) setLoaded(v);
    });
    return () => {
      alive = false;
    };
  }, [busy]);

  const onLoad = async () => {
    setBusy('load');
    try {
      await loadDemoData();
      toast.show(t('demo.loaded'), 'success');
    } catch {
      toast.show(t('demo.alreadyLoaded'), 'info');
    } finally {
      setBusy(null);
    }
  };

  const onClear = async () => {
    setConfirmClear(false);
    setBusy('clear');
    try {
      await clearUnitData();
      toast.show(t('demo.cleared'), 'success');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardTitle className="flex items-center gap-2">
        <Sparkles aria-hidden="true" className="text-saffron" size={22} />
        {t('demo.title')}
      </CardTitle>
      <p className="text-base text-muted">{t('demo.subtitle')}</p>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <StatTile label={t('demo.statLooms')} value={24} tone="info" />
        <StatTile label={t('demo.statWeavers')} value={24} tone="info" />
        <StatTile label={t('demo.statOrders')} value={3} tone="info" />
        <StatTile label={t('demo.statRecords')} value="100+" tone="info" />
      </div>

      <p className="mt-4 text-sm text-muted">{t('demo.hint')}</p>

      {!mayManage ? (
        <p className="mt-4 rounded-xl bg-bg px-3 py-2 text-sm text-muted" role="note">
          {t('demo.ownerOnly')}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <Button
            data-testid="load-demo"
            size="xl"
            variant="primary"
            disabled={busy !== null || loaded === true}
            aria-busy={busy === 'load'}
            onClick={onLoad}
          >
            {busy === 'load' ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Database aria-hidden="true" />
            )}
            {busy === 'load' ? t('demo.loading') : loaded ? t('demo.alreadyLoaded') : t('demo.load')}
          </Button>

          {loaded && (
            <Button
              data-testid="clear-demo"
              size="lg"
              variant="danger"
              disabled={busy !== null}
              aria-busy={busy === 'clear'}
              onClick={() => setConfirmClear(true)}
            >
              {busy === 'clear' ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              {busy === 'clear' ? t('demo.clearing') : t('demo.clear')}
            </Button>
          )}
        </div>
      )}

      <ConfirmSheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={onClear}
        title={t('demo.clearConfirmTitle')}
        message={t('demo.clearConfirmMsg')}
        confirmLabel={t('demo.clearConfirmBtn')}
        danger
      />
    </Card>
  );
}

export default DemoPanel;
