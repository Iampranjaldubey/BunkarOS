// Bunkar OS — monthly summary (K1 / SPEC-018). Pure, integer paise.
// A month is a 'YYYY-MM' string; records belong to the month when their IST
// `day` starts with it. All projections ignore reversed + rejected records.
import type { Rec, BazaarP, PeshgiP, JobP, Lang } from '../db/types.ts';
import { recsOfType } from './records.ts';
import { formatINR } from './money.ts';
import { gramsToKgStr } from './units.ts';

export interface MonthlySummary {
  month: string;              // 'YYYY-MM'
  bazaarCount: number;
  sqftWoven: number;          // 2 dp
  wageBillPaise: number;      // bazaar gross + job amount
  paidPaise: number;          // bazaar paid + job paid
  peshgiGivenPaise: number;
  peshgiRecoveredPaise: number;
  woolUsedG: number;
  woolShortG: number;
  yarnLossPct: number | null; // short / used × 100, 1 dp; null if used 0
}

/** Build the summary for one calendar month (Asia/Kolkata days). */
export function monthlySummary(recs: Rec[], month: string): MonthlySummary {
  const inMonth = (day: string) => day.startsWith(`${month}-`);

  const bazaars = recsOfType<BazaarP>(recs, 'bazaar').filter((r) => inMonth(r.day));
  const jobs = recsOfType<JobP>(recs, 'job').filter((r) => inMonth(r.day));
  const peshgis = recsOfType<PeshgiP>(recs, 'peshgi').filter((r) => inMonth(r.day));

  let sqftWoven = 0;
  let bazaarGrossPaise = 0;
  let bazaarPaidPaise = 0;
  let peshgiRecoveredPaise = 0;
  let woolUsedG = 0;
  let woolShortG = 0;
  for (const r of bazaars) {
    const b = r.payload;
    sqftWoven += b.areaSqft;
    bazaarGrossPaise += b.grossPaise;
    bazaarPaidPaise += b.paidPaise;
    peshgiRecoveredPaise += b.peshgiRecoveredPaise;
    woolUsedG += b.tauli.usedG;
    woolShortG += b.tauli.shortG;
  }

  let jobAmountPaise = 0;
  let jobPaidPaise = 0;
  for (const r of jobs) {
    jobAmountPaise += r.payload.amountPaise;
    jobPaidPaise += r.payload.paidPaise;
  }

  let peshgiGivenPaise = 0;
  for (const r of peshgis) peshgiGivenPaise += r.payload.amountPaise;

  const yarnLossPct = woolUsedG > 0 ? Math.round((woolShortG / woolUsedG) * 1000) / 10 : null;

  return {
    month,
    bazaarCount: bazaars.length,
    sqftWoven: Math.round(sqftWoven * 100) / 100,
    wageBillPaise: bazaarGrossPaise + jobAmountPaise,
    paidPaise: bazaarPaidPaise + jobPaidPaise,
    peshgiGivenPaise,
    peshgiRecoveredPaise,
    woolUsedG,
    woolShortG,
    yarnLossPct,
  };
}

const LOCALE: Record<Lang, string> = { hi: 'hi-IN', en: 'en-IN' };

/** Human month+year via Intl in Asia/Kolkata, e.g. "अक्टूबर 2026" / "October 2026". */
export function monthLabel(month: string, lang: Lang): string {
  const d = new Date(`${month}-15T12:00:00+05:30`);
  if (Number.isNaN(d.getTime())) throw new RangeError('monthLabel: invalid month');
  return new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d);
}

/** Hindi monthly summary, one fact per line (for WhatsApp share). */
export function monthlyTextHi(m: MonthlySummary): string {
  const loss = m.yarnLossPct === null ? '—' : `${m.yarnLossPct.toFixed(1)}%`;
  return [
    `बुनकर OS — ${monthLabel(m.month, 'hi')} का मासिक सार`,
    `• बाज़ार: ${m.bazaarCount} कालीन`,
    `• बुनाई: ${m.sqftWoven.toFixed(2)} वर्ग फुट`,
    `• मज़दूरी बिल: ${formatINR(m.wageBillPaise, { paise: true })}`,
    `• दिया: ${formatINR(m.paidPaise, { paise: true })}`,
    `• पेशगी दी: ${formatINR(m.peshgiGivenPaise)}`,
    `• पेशगी वसूली: ${formatINR(m.peshgiRecoveredPaise)}`,
    `• ऊन इस्तेमाल: ${gramsToKgStr(m.woolUsedG)} किग्रा`,
    `• ऊन कमी: ${gramsToKgStr(m.woolShortG)} किग्रा`,
    `• ऊन नुकसान: ${loss}`,
    `• रिजेक्ट: — (अभी दर्ज नहीं)`,
  ].join('\n');
}

/** English monthly summary, one fact per line. */
export function monthlyTextEn(m: MonthlySummary): string {
  const loss = m.yarnLossPct === null ? '—' : `${m.yarnLossPct.toFixed(1)}%`;
  return [
    `Bunkar OS — monthly summary for ${monthLabel(m.month, 'en')}`,
    `• Bazaars: ${m.bazaarCount} carpets`,
    `• Woven: ${m.sqftWoven.toFixed(2)} sq ft`,
    `• Wage bill: ${formatINR(m.wageBillPaise, { paise: true })}`,
    `• Paid: ${formatINR(m.paidPaise, { paise: true })}`,
    `• Peshgi given: ${formatINR(m.peshgiGivenPaise)}`,
    `• Peshgi recovered: ${formatINR(m.peshgiRecoveredPaise)}`,
    `• Wool used: ${gramsToKgStr(m.woolUsedG)} kg`,
    `• Wool short: ${gramsToKgStr(m.woolShortG)} kg`,
    `• Yarn loss: ${loss}`,
    `• Rejects: — (not tracked yet)`,
  ].join('\n');
}
