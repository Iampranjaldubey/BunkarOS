import type { Rec, PhotoRow } from '../db/types';

export interface SyncStateView {
  pending: number;
  lastSyncAt: string | null;
  online: boolean;
  error: string | null;
  syncing: boolean;
  /** 'ok' once a valid token is held; 'needs_login' when the server wants a fresh login. */
  authState: 'ok' | 'needs_login';
  /** SPEC-M13: true while the device clears and re-pulls its data because the owner changed what it may see. */
  resyncing?: boolean;
}
/** What the server removed for this token (SPEC-M13). Owner: everything visible. */
export interface SyncView { seePrices: boolean }
export interface SyncResponse {
  accepted: string[];
  rejected: { id: string; reason: string }[];
  records: Rec[];
  cursor: number;
  view?: SyncView;
}
export interface SyncDb {
  records: {
    where(index: string): {
      equals(value: string): {
        limit(n: number): { toArray(): Promise<Rec[]> };
        toArray(): Promise<Rec[]>;
        count(): Promise<number>;
      };
    };
    get(id: string): Promise<Rec | undefined>;
    put(rec: Rec): Promise<string>;
    update(id: string, changes: Partial<Rec>): Promise<number>;
  };
  photos: { where(index: string): { equals(value: string): { toArray(): Promise<PhotoRow[]> } }; update(id: string, changes: Partial<PhotoRow>): Promise<number>; };
  meta: { get(key: string): Promise<{ key: string; value: unknown } | undefined>; put(row: { key: string; value: unknown }): Promise<string>; };
}
