import Dexie, { type Table } from 'dexie';
import type { Rec, PhotoRow } from './types';

export interface MetaRow {
  key: string;
  value: unknown;
}

// Bunkar OS local store (IndexedDB via Dexie).
// Append-only `records`, compressed `photos`, and small `meta` key/value.
// Indexes per architecture contract: records on &id,type,unitId,sync,day,at.
export class BunkarDB extends Dexie {
  records!: Table<Rec, string>;
  photos!: Table<PhotoRow, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('bunkar');
    this.version(1).stores({
      records: '&id, type, unitId, sync, day, at',
      photos: '&id, sync',
      meta: '&key',
    });
  }
}

export const db = new BunkarDB();

/** Read a meta value by key (typed by caller). */
export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

/** Write a meta value by key. */
export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
