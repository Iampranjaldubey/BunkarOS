import { useEffect, useState } from 'react';
import { Card, CardTitle } from '../components/ui/Card';
import { Dot } from '../components/ui/Badge';
import { MODULES } from '../domain/modules';
import { PACKS } from '../industries';
import { RugArt } from '../components/carpet/RugArt';
import { BagArt, StitchLine } from '../industries/bags/art';
import { GuardBorder } from '../components/carpet/Carpet';
import { AdminShell } from './AdminShell';
import { AdminLoginPage } from './AdminLoginPage';
import { fetchIndustries, getAdmin, MODULE_LABEL, type Industry } from './api';
import { INDUSTRY_LABEL, JOB_LABEL, UNIT_LABEL } from './labels';

/** /admin/industries — what each industry pack contains (read-only; packs are code, SPEC-M18 §8). */
export default function AdminIndustriesPage() {
  const [authed, setAuthed] = useState(() => Boolean(getAdmin()));
  const [industries, setIndustries] = useState<Industry[]>([]);
  useEffect(() => { if (authed) void fetchIndustries().then((d) => { if (d) setIndustries(d.industries); else setAuthed(Boolean(getAdmin())); }); }, [authed]);
  if (!authed) return <AdminLoginPage onDone={() => setAuthed(true)} />;
  return (
    <AdminShell>
      <h1 className="mb-1 text-3xl">Industry packs</h1>
      <p className="mb-6 text-ink-2">Each organisation gets its industry's words, lists and drawings. Changing a pack is a code change with tests.</p>
      <div className="grid gap-5 lg:grid-cols-2" data-testid="industry-packs">
        {industries.map((ind) => {
          const pack = PACKS[ind.id as keyof typeof PACKS];
          if (!pack) return null;
          return (
            <Card key={ind.id} className="flex flex-col gap-4 p-0" data-testid={`pack-${ind.id}`}>
              <div className="aspect-[16/7] overflow-hidden rounded-t-2xl border-b border-line">
                {ind.id === 'bags' ? <BagArt design="Backpack" seed="pack" /> : <RugArt design="Kashan" seed="pack" />}
              </div>
              <div className="px-5 pb-5">
                <CardTitle className="mb-2">{INDUSTRY_LABEL[ind.id] ?? ind.name}</CardTitle>
                <div className="mb-4">{ind.id === 'bags' ? <StitchLine /> : <GuardBorder />}</div>
                <dl className="grid gap-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <dt className="text-muted">Job titles</dt><dd className="text-ink">{pack.jobs.map((j) => JOB_LABEL[j] ?? j).join(', ')}</dd>
                  <dt className="text-muted">Material units</dt><dd className="text-ink">{pack.itemUnits.map((u) => UNIT_LABEL[u] ?? u).join(', ')}</dd>
                  <dt className="text-muted">Suggested materials</dt><dd className="text-ink">{pack.materials.en.join(', ')}</dd>
                  <dt className="text-muted">Catalogue sizes</dt><dd className="text-ink">{pack.sizeUnit}</dd>
                  <dt className="text-muted">Vocabulary</dt><dd className="text-ink">{Object.keys(pack.words.en ?? {}).length ? `${Object.keys(pack.words.en ?? {}).length} phrases in its own words, e.g. “${pack.words.en?.['cat.title'] ?? ''}”` : 'The base words (कालीन, बुनकर, ऊन)'}</dd>
                  <dt className="text-muted">Default modules</dt>
                  <dd className="flex flex-wrap gap-x-4 gap-y-1">{MODULES.map((m) => <Dot key={m} tone={ind.defaultModules[m] ? 'received' : 'neutral'}>{MODULE_LABEL[m].name}</Dot>)}</dd>
                </dl>
              </div>
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}
