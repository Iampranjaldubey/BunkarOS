import { describe, it, expect } from 'vitest';
import type { OrderP, RateP, NormP, YarnIssueP } from '../db/types.ts';
import { rec } from './_testutil.ts';
import { rateForPiece, normFor } from './rates.ts';

const order: OrderP = {
  entityId: 'ord-1', orderNo: 'EX-118/03', exporter: 'Acme', design: 'Floral',
  quality: 'Q10', colour: 'Ivory', lengthIn: 119, widthIn: 72, count: 1,
  pieces: [{ pieceId: 'EX-118/03/01', seq: 1 }],
};

describe('rateForPiece (D2)', () => {
  it('locks to the rate in force on the first yarn issue day', () => {
    const recs = [
      rec<OrderP>('order', order),
      rec<RateP>('rate', { entityId: 'r1', quality: 'Q10', unit: 'sqft', ratePaise: 5000, effectiveFrom: '2026-01-01' }),
      // later rate change AFTER the issue — should be ignored
      rec<RateP>('rate', { entityId: 'r2', quality: 'Q10', unit: 'sqft', ratePaise: 6000, effectiveFrom: '2026-10-05' }),
      rec<YarnIssueP>('yarn_issue', { holder: { kind: 'loom', loomId: 'l1', pieceId: 'EX-118/03/01' }, shade: 'red', lot: 'A', grams: 10000 }, { day: '2026-09-01' }),
    ];
    const r = rateForPiece(recs, 'EX-118/03/01', '2026-10-09');
    expect(r?.ratePaise).toBe(5000);
  });

  it('uses onDay when there is no yarn issue', () => {
    const recs = [
      rec<OrderP>('order', order),
      rec<RateP>('rate', { entityId: 'r1', quality: 'Q10', unit: 'sqft', ratePaise: 5000, effectiveFrom: '2026-01-01' }),
      rec<RateP>('rate', { entityId: 'r2', quality: 'Q10', unit: 'sqft', ratePaise: 6000, effectiveFrom: '2026-10-05' }),
    ];
    expect(rateForPiece(recs, 'EX-118/03/01', '2026-10-09')?.ratePaise).toBe(6000);
    expect(rateForPiece(recs, 'EX-118/03/01', '2026-10-04')?.ratePaise).toBe(5000);
  });

  it('returns undefined when no rate applies', () => {
    const recs = [rec<OrderP>('order', order)];
    expect(rateForPiece(recs, 'EX-118/03/01', '2026-10-09')).toBeUndefined();
  });

  it('normFor returns latest grams/sqft', () => {
    const recs = [rec<NormP>('norm', { entityId: 'n1', quality: 'Q10', gramsPerSqft: 150 })];
    expect(normFor(recs, 'Q10')).toBe(150);
    expect(normFor(recs, 'Q99')).toBeUndefined();
  });
});
