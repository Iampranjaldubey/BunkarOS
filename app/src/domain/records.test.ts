import { describe, it, expect } from 'vitest';
import type { PeshgiP, ReversalP } from '../db/types.ts';
import { rec } from './_testutil.ts';
import { activeRecords, latestEntities } from './records.ts';
import type { WeaverP } from '../db/types.ts';

describe('activeRecords exclusions', () => {
  it('excludes reversed targets and the reversal record itself', () => {
    const target = rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 100000, mode: 'cash' }, { id: 'tgt' });
    const reversal = rec<ReversalP>('reversal', { targetId: 'tgt', reason: 'mistake' });
    const other = rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 50000, mode: 'cash' }, { id: 'keep' });
    const active = activeRecords([target, reversal, other]);
    expect(active.map((r) => r.id)).toEqual(['keep']);
  });

  it('excludes rejected records', () => {
    const ok = rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 1, mode: 'cash' }, { id: 'ok' });
    const bad = rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 1, mode: 'cash' }, { id: 'bad', sync: 'rejected', rejectReason: 'dup' });
    expect(activeRecords([ok, bad]).map((r) => r.id)).toEqual(['ok']);
  });

  it('a rejected reversal does not reverse its target', () => {
    const target = rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 1, mode: 'cash' }, { id: 'tgt' });
    const badReversal = rec<ReversalP>('reversal', { targetId: 'tgt', reason: 'x' }, { sync: 'rejected' });
    expect(activeRecords([target, badReversal]).map((r) => r.id)).toEqual(['tgt']);
  });

  it('latestEntities keeps newest version by at', () => {
    const v1 = rec<WeaverP>('weaver', { entityId: 'w1', name: 'Old', fatherName: 'F', village: 'V', phone: '1', phoneType: 'smartphone', active: true }, { at: '2026-10-01T10:00:00Z' });
    const v2 = rec<WeaverP>('weaver', { entityId: 'w1', name: 'New', fatherName: 'F', village: 'V', phone: '1', phoneType: 'smartphone', active: true }, { at: '2026-10-05T10:00:00Z' });
    const list = latestEntities<WeaverP>([v1, v2], 'weaver');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('New');
  });
});
