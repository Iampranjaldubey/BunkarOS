import { describe, it, expect } from 'vitest';
import type { LoomP, UserP } from '../db/types.ts';
import { rec } from './_testutil.ts';
import { can, visibleLoomIds } from './permissions.ts';

describe('permissions matrix', () => {
  it('owner can do everything', () => {
    for (const a of ['rate.edit', 'settings.edit', 'user.manage', 'record.reverse.any', 'bazaar.create', 'digest.view', 'checkin.create'] as const) {
      expect(can('owner', a)).toBe(true);
    }
  });

  it('munshi cannot edit rate/settings/users or reverse any', () => {
    expect(can('munshi', 'rate.edit')).toBe(false);
    expect(can('munshi', 'settings.edit')).toBe(false);
    expect(can('munshi', 'user.manage')).toBe(false);
    expect(can('munshi', 'record.reverse.any')).toBe(false);
    // but can do operational things
    expect(can('munshi', 'bazaar.create')).toBe(true);
    expect(can('munshi', 'peshgi.give')).toBe(true);
    expect(can('munshi', 'record.reverse.ownToday')).toBe(true);
    expect(can('munshi', 'digest.view')).toBe(true);
    expect(can('munshi', 'checkin.create')).toBe(true);
  });

  it('owner and munshi can create jobs; thekedar cannot', () => {
    expect(can('owner', 'job.create')).toBe(true);
    expect(can('munshi', 'job.create')).toBe(true);
    expect(can('thekedar', 'job.create')).toBe(false);
  });

  it('thekedar only checkin.create, no digest', () => {
    expect(can('thekedar', 'checkin.create')).toBe(true);
    expect(can('thekedar', 'digest.view')).toBe(false);
    expect(can('thekedar', 'bazaar.create')).toBe(false);
    expect(can('thekedar', 'yarn.issue')).toBe(false);
    expect(can('thekedar', 'rate.edit')).toBe(false);
  });
});

describe('visibleLoomIds', () => {
  const recs = [
    rec<LoomP>('loom', { entityId: 'l1', code: 'L1', village: 'V', widthIn: 72, thekedarId: 't1', weaverIds: [], active: true }),
    rec<LoomP>('loom', { entityId: 'l2', code: 'L2', village: 'V', widthIn: 72, thekedarId: 't2', weaverIds: [], active: true }),
    rec<LoomP>('loom', { entityId: 'l3', code: 'L3', village: 'V', widthIn: 72, weaverIds: [], active: true }),
  ];

  it('owner/munshi see all looms', () => {
    const owner: UserP = { entityId: 'u1', name: 'O', phone: '1', role: 'owner', pinHash: 'h', pinSalt: 's', active: true };
    expect(visibleLoomIds(recs, owner).sort()).toEqual(['l1', 'l2', 'l3']);
  });

  it('thekedar sees only own looms', () => {
    const thek: UserP = { entityId: 'u2', name: 'T', phone: '1', role: 'thekedar', pinHash: 'h', pinSalt: 's', thekedarId: 't1', active: true };
    expect(visibleLoomIds(recs, thek)).toEqual(['l1']);
  });
});
