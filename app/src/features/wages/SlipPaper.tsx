import { useT } from '../../i18n';
import { cn } from '../../lib/utils';
import type { SlipContent } from './lines';
import { Signature } from '../../industries/ui';

/**
 * The printed wage slip (D-003): a real A4 page with the owner's chosen sections.
 * Used for printing (inside a `print:block` container) and, scaled down, as the live preview in Settings.
 */
export function SlipPaper({ c, className, testid = 'slip-paper' }: { c: SlipContent; className?: string; testid?: string }) {
  const { t } = useT();
  return (
    <article data-testid={testid} className={cn('slip-paper mx-auto flex flex-col bg-white p-[14mm] text-[11pt] leading-snug text-black', className)}>
      <header className="mb-6 text-center">
        <h1 className="font-display text-[20pt] font-medium leading-tight text-black">{c.business}</h1>
        <p className="mt-1 text-[12pt]">{t('slip.title')} — {c.month}</p>
        {/* The guard border in ink: prints on any printer, and makes the slip recognisably the unit's own (SPEC-M17). */}
        <Signature tone="ink" className="mt-3" />
      </header>
      <p className="mb-4 text-[13pt]"><span className="text-[10pt]">{t('slip.sec.workerName')}:</span> <strong>{c.worker}</strong></p>
      <table className="w-full border-collapse text-[11pt]" data-testid={`${testid}-rows`}>
        <tbody>
          {c.rows.map((r, i) => (
            <tr key={i} className={cn('border-b border-black/30', r.strong && 'border-t-2 border-black text-[13pt] font-medium')} data-section={r.section}>
              <td className="py-1.5 pr-4">{r.label}</td>
              <td className="num py-1.5 text-right">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {c.signature && (
        <footer className="mt-auto grid grid-cols-2 gap-12 pt-16 text-[10pt]" data-testid={`${testid}-signature`}>
          <div className="border-t border-black pt-1 text-center">{t('slip.signWorker')}</div>
          <div className="border-t border-black pt-1 text-center">{t('slip.signOwner')}</div>
        </footer>
      )}
    </article>
  );
}
