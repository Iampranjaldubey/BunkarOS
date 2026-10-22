import type { Rec, PhotoRow } from '../db/types';

export interface SyncStateView {
  pending: number;
  lastSyncAt: string | null;
  online: boolean;
  error: string | null;
  syncing: boolean;
  /** 'ok' once a valid token is held; 'needs_login' when the server wants a fresh login. */
  authState: 'ok' | 'needs_login';
}
export interface SyncResponse {
  accepted: string[];
  rejected: { id: string; reason: string }[];
  records: Rec[];
  cursor: number;
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
