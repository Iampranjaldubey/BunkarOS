import Dexie, { type Table } from 'dexie';
import type { Rec, PhotoRow } from './types';

export interface MetaRow { key: string; value: unknown; }

/** Local store (IndexedDB via Dexie): append-only records, compressed photos, meta. */
export class BunkarDB extends Dexie {
  records!: Table<Rec, string>;
  photos!: Table<PhotoRow, string>;
  meta!: Table<MetaRow, string>;
  constructor() {
    super('bunkar-mvp');
    this.version(1).stores({
      records: '&id, type, unitId, sync, day, at',
      photos: '&id, sync',
      meta: '&key',
    });
  }
}

export const db = new BunkarDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
