// Master projections (pure). Latest version per entityId; reversed/rejected ignored.
import type { Rec, SettingP, UserP, WorkerP, ItemP, BuyerP, OrderP } from '../db/types.ts';
import { latestEntities } from './records.ts';

export function getSettings(recs: Rec[]): SettingP | undefined {
  return latestEntities<SettingP>(recs, 'setting')[0];
}
export function listUsers(recs: Rec[]): UserP[] { return latestEntities<UserP>(recs, 'user'); }
export function listWorkers(recs: Rec[], onlyActive = true): WorkerP[] {
  const all = latestEntities<WorkerP>(recs, 'worker').sort((a, b) => a.name.localeCompare(b.name));
  return onlyActive ? all.filter((w) => w.active) : all;
}
export function listItems(recs: Rec[], onlyActive = true): ItemP[] {
  const all = latestEntities<ItemP>(recs, 'item').sort((a, b) => a.name.localeCompare(b.name));
  return onlyActive ? all.filter((i) => i.active) : all;
}
export function listBuyers(recs: Rec[], onlyActive = true): BuyerP[] {
  const all = latestEntities<BuyerP>(recs, 'buyer').sort((a, b) => a.name.localeCompare(b.name));
  return onlyActive ? all.filter((b) => b.active) : all;
}
export function listOrders(recs: Rec[]): OrderP[] { return latestEntities<OrderP>(recs, 'order'); }

/** Name lookup maps for the log and lists. */
export function nameMaps(recs: Rec[]) {
  const users = new Map(listUsers(recs).map((u) => [u.entityId, u.name]));
  const workers = new Map(listWorkers(recs, false).map((w) => [w.entityId, w.name]));
  const items = new Map(listItems(recs, false).map((i) => [i.entityId, i]));
  const buyers = new Map(listBuyers(recs, false).map((b) => [b.entityId, b.name]));
  const orders = new Map(listOrders(recs).map((o) => [o.entityId, o]));
  return { users, workers, items, buyers, orders };
}

/** Next order number ORD-001, ORD-002 … (max existing + 1). */
export function nextOrderNo(recs: Rec[]): string {
  let max = 0;
  for (const o of listOrders(recs)) { const m = /^ORD-(\d+)$/.exec(o.orderNo); if (m) max = Math.max(max, Number(m[1])); }
  return `ORD-${String(max + 1).padStart(3, '0')}`;
}
