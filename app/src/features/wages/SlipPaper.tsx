import { useT } from '../../i18n';
import { cn } from '../../lib/utils';
import type { SlipContent } from './lines';

/**
 * The printed wage slip (D-003): a real A4 page with the owner's chosen sections.
 * Used for printing (inside a `print:block` container) and, scaled down, as the live preview in Settings.
 */
export function SlipPaper({ c, className, testid = 'slip-paper' }: { c: SlipContent; className?: string; testid?: string }) {
  const { t } = useT();
  return (
    <article data-testid={testid} className={cn('slip-paper mx-auto flex flex-col bg-white p-[14mm] text-[11pt] leading-snug text-black', className)}>
      <header className="mb-6 border-b-2 border-black pb-3 text-center">
        <h1 className="font-display text-[20pt] leading-tight text-black">{c.business}</h1>
        <p className="mt-1 text-[12pt]">{t('slip.title')} — {c.month}</p>
      </header>
      <p className="mb-4 text-[13pt]"><span className="text-[10pt]">{t('slip.sec.workerName')}:</span> <strong>{c.worker}</strong></p>
      <table className="w-full border-collapse text-[11pt]" data-testid={`${testid}-rows`}>
        <tbody>
          {c.rows.map((r, i) => (
            <tr key={i} className={cn('border-b border-black/30', r.strong && 'border-t-2 border-black text-[13pt] font-bold')} data-section={r.section}>
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
