import type { ReactNode } from 'react';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';
import { BrandMark } from '../components/carpet/Carpet';
import { ProductArt, Signature } from '../industries/ui';
import { usePack } from '../industries/usePack';
import { useT } from '../i18n';

/**
 * Setup + login. SPEC-M17: phone = the brand, then the card; desktop = a split, a drawn rug weaving in on the left
 * (the one rich moment) and the card on the right. No gradient wash; the guard border tops the card.
 */
export function AuthShell({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  const { t } = useT();
  const pack = usePack();
  return (
    <div className="relative min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(28rem,36rem)]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-surface-2 lg:flex lg:flex-col lg:justify-between lg:p-12" aria-hidden="true">
        <div className="flex items-center gap-3">
          <BrandMark size={36} />
          <span className="font-display text-xl font-medium text-ink">{t('app.name')}</span>
        </div>
        <div className="mx-auto w-full max-w-xl">
          <ProductArt design={pack.id === 'bags' ? 'Backpack' : 'Kashan medallion'} length={3} width={2} seed="login" weave floor={false} className="aspect-[4/3]" fabric="#2f3f91" />
        </div>
        <div className="max-w-md">
          <p className="font-display text-3xl font-medium leading-tight text-ink">{t('m17.loginTitle')}</p>
          <p className="mt-2 text-base text-ink-2">{t('m17.loginLine')}</p>
        </div>
      </aside>

      <div className="relative">
        <div className="absolute right-4 top-3 z-10 md:right-8 md:top-6"><LanguageSwitch /></div>
        <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 pb-10 pt-20 md:max-w-lg">
          <div className="rise-in text-center">
            <BrandMark size={56} className="mx-auto mb-4" />
            <h1 className="text-4xl">{title ?? t('app.name')}</h1>
            <p className="mt-1 text-ink-2">{subtitle ?? t('app.tagline')}</p>
          </div>
          <div className="rise-in flex flex-col gap-6" style={{ ['--i' as string]: 1 }}>{children}</div>
        </main>
      </div>
    </div>
  );
}

/** The auth card: the guard border along its top edge (the signature, SPEC-M17). */
export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-3xl border border-line bg-surface ${className ?? ''}`}>
      <Signature className="h-2.5" />
      <div className="p-5 md:p-6">{children}</div>
    </div>
  );
}
