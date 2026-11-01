// SPEC-M15 catalogue projections and limits (AC1, AC3–AC7, AC10–AC14).
import { describe, it, expect } from 'vitest';
import type { Rec, CarpetP, CarpetInP, CarpetReserveP, CarpetOutP, DeliveryP, OrderP, ReversalP, RecordType } from '../db/types';
import { carpetView, carpetViews, carpetError, filterCarpets, filterOptions, moveError, moveLimits, orderCatalogue, sizeLabel, sizeKey, tagTaken, carpetHistory, DEFAULT_STATUS_FILTER } from './catalogue';
import { orderView } from './orders';

let n = 0;
const rec = <P,>(type: RecordType, payload: P, day = '2026-11-01'): Rec<P> =>
  ({ id: `r${++n}`, type, unitId: 'u', payload, by: 'owner', role: 'owner', device: 'd', at: `2026-11-01T10:${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}Z`, day, sync: 'synced' });
const carpet = (over: Partial<CarpetP> = {}): CarpetP => ({ entityId: 'kashan', design: 'Kashan 101', lengthMilli: 8000, widthMilli: 10000, sizeUnit: 'ft', mode: 'quantity', photoIds: ['p1', 'p2', 'p3'], pricePaise: 4_500_000, costPaise: 3_000_000, active: true, ...over });
const order = (over: Partial<OrderP> = {}): OrderP => ({ entityId: 'ord1', buyerId: 'b', orderNo: 'ORD-001', design: 'Kashan', size: '8x10', qty: 4, dueDate: '2026-12-01', receivedOn: '2026-11-01', ...over });
const counts = (recs: Rec[], id = 'kashan') => carpetView(recs, id)!.counts;

function base(): Rec[] {
  return [rec('carpet', carpet()), rec<CarpetInP>('carpet_in', { carpetId: 'kashan', qty: 5 }), rec('order', order())];
}

describe('AC1: quantity carpet "Kashan 101", 8 × 10 ft, qty 5, 3 photos', () => {
  it('shows 5 in stock, cover = first photo, size label', () => {
    const [v] = carpetViews(base());
    expect(v.counts).toEqual({ added: 5, reserved: 0, delivered: 0, sold: 0, writtenOff: 0, inStock: 5 });
    expect([v.status, v.statuses]).toEqual(['in_stock', ['in_stock']]);
    expect(v.carpet.photoIds[0]).toBe('p1');
    expect(sizeLabel(v.carpet)).toBe('8 × 10 ft');
    expect(sizeLabel({ lengthMilli: 2440, widthMilli: 3050, sizeUnit: 'm' })).toBe('2.44 × 3.05 m');
  });
  it('AC2: at most 4 photos; sizes must be positive', () => {
    expect(carpetError([], carpet({ photoIds: ['a', 'b', 'c', 'd'] }))).toBe('');
    expect(carpetError([], carpet({ photoIds: ['a', 'b', 'c', 'd', 'e'] }))).toBe('too_many_photos');
    expect(carpetError([], carpet({ widthMilli: 0 }))).toBe('invalid_size');
    expect(carpetError([], carpet({ design: ' ' }))).toBe('design_required');
  });
});

describe('AC3: piece tags are unique per unit', () => {
  it('a second active carpet with tag "BH-0042" is refused; the same carpet may keep its tag', () => {
    const recs = [rec('carpet', carpet({ entityId: 'p42', mode: 'piece', tag: 'BH-0042' }))];
    expect(tagTaken(recs, 'bh-0042 ')).toBe(true);
    expect(carpetError(recs, carpet({ entityId: 'other', mode: 'piece', tag: 'BH-0042' }))).toBe('duplicate_tag');
    expect(carpetError(recs, carpet({ entityId: 'p42', mode: 'piece', tag: 'BH-0042', notes: 'edit' }))).toBe('');
    expect(carpetError(recs, carpet({ entityId: 'other', mode: 'piece', tag: '' }))).toBe('tag_required');
    // Once the first one is inactive, the tag is free again.
    const inactive = [...recs, rec('carpet', carpet({ entityId: 'p42', mode: 'piece', tag: 'BH-0042', active: false }))];
    expect(tagTaken(inactive, 'BH-0042')).toBe(false);
  });
  it('a piece is added once, with qty 1', () => {
    const recs = [rec('carpet', carpet({ entityId: 'p42', mode: 'piece', tag: 'BH-0042' }))];
    expect(moveError(recs, 'carpet_in', { carpetId: 'p42', qty: 2 })).toBe('invalid_qty');
    expect(moveError(recs, 'carpet_in', { carpetId: 'p42', qty: 1 })).toBe('');
    expect(moveError([...recs, rec<CarpetInP>('carpet_in', { carpetId: 'p42', qty: 1 })], 'carpet_in', { carpetId: 'p42', qty: 1 })).toBe('piece_added');
  });
});

describe('AC4–AC5: reserve for an order, deliver from the reservation', () => {
  it('reserve 3 → in stock 2, reserved 3; 2 more is refused (order needs 1)', () => {
    const recs = [...base(), rec<CarpetReserveP>('carpet_reserve', { carpetId: 'kashan', orderId: 'ord1', qty: 3 })];
    expect(counts(recs)).toMatchObject({ inStock: 2, reserved: 3 });
    expect(moveLimits(recs, 'kashan', 'ord1')).toMatchObject({ orderNeed: 1, reserveMax: 1 });
    expect(moveError(recs, 'carpet_reserve', { carpetId: 'kashan', orderId: 'ord1', qty: 2 })).toBe('exceeds_order');
    expect(moveError(recs, 'carpet_reserve', { carpetId: 'kashan', orderId: 'ord1', qty: 1 })).toBe('');
    expect(moveError(base(), 'carpet_reserve', { carpetId: 'kashan', orderId: 'ord1', qty: 6 })).toBe('insufficient_stock');
    expect(moveError(base(), 'carpet_reserve', { carpetId: 'kashan', orderId: 'nope', qty: 1 })).toBe('unknown_order');
  });
  it('deliver 2 → reserved 1, delivered 2, order 2/4, pending 2, status unchanged; 3 more refused', () => {
    const recs = [...base(), rec<CarpetReserveP>('carpet_reserve', { carpetId: 'kashan', orderId: 'ord1', qty: 3 }), rec<DeliveryP>('delivery', { orderId: 'ord1', qty: 2, carpetId: 'kashan' })];
    expect(counts(recs)).toMatchObject({ inStock: 2, reserved: 1, delivered: 2 });
    const ov = orderView(recs, 'ord1', '2026-11-02')!;
    expect([ov.deliveredQty, ov.pendingQty, ov.status]).toEqual([2, 2, 'new']);
    expect(orderCatalogue(recs, 'ord1')).toEqual([{ carpetId: 'kashan', reserved: 1, delivered: 2 }]);
    expect(moveError(recs, 'delivery', { carpetId: 'kashan', orderId: 'ord1', qty: 3 })).toBe('exceeds_order');
    expect(moveLimits(recs, 'kashan', 'ord1').deliverMax).toBe(2);
  });
  it('a delivery uses the reservation first, then stock', () => {
    const recs = [...base(), rec<CarpetReserveP>('carpet_reserve', { carpetId: 'kashan', orderId: 'ord1', qty: 1 }), rec<DeliveryP>('delivery', { orderId: 'ord1', qty: 3, carpetId: 'kashan' })];
    expect(counts(recs)).toMatchObject({ reserved: 0, delivered: 3, inStock: 2 });
  });
});

describe('AC6–AC7: status, search and filters', () => {
  const piece = (id: string, tag: string) => [rec('carpet', carpet({ entityId: id, design: 'Bokhara', mode: 'piece', tag, lengthMilli: 6000, widthMilli: 9000, pricePaise: 2_000_000 })), rec<CarpetInP>('carpet_in', { carpetId: id, qty: 1 })];
  it('piece reserved then delivered → delivered, hidden by default, shown with the delivered filter', () => {
    const r1 = rec<CarpetReserveP>('carpet_reserve', { carpetId: 'p42', orderId: 'ord1', qty: 1 });
    let recs = [...base(), ...piece('p42', 'BH-0042'), r1];
    expect(carpetView(recs, 'p42')!.status).toBe('reserved');
    recs = [...recs, rec<DeliveryP>('delivery', { orderId: 'ord1', qty: 1, carpetId: 'p42' })];
    expect(carpetView(recs, 'p42')!.status).toBe('delivered');
    const views = carpetViews(recs);
    expect(filterCarpets(views, { statuses: DEFAULT_STATUS_FILTER }).map((v) => v.carpet.entityId)).toEqual(['kashan']);
    expect(filterCarpets(views, { statuses: [...DEFAULT_STATUS_FILTER, 'delivered'] }).map((v) => v.carpet.entityId)).toEqual(['p42', 'kashan']);
  });
  it('search "kashan" + size 8 × 10 finds it; "reserved" shows only carpets with a reservation; price range', () => {
    const recs = [...base(), ...piece('p43', 'BH-0043'), rec<CarpetReserveP>('carpet_reserve', { carpetId: 'kashan', orderId: 'ord1', qty: 1 }),
      rec('carpet', carpet({ entityId: 'n1', design: 'Nain', notes: 'Kashan style border', photoIds: [], pricePaise: undefined, lengthMilli: 5000, widthMilli: 8000 }))];
    const views = carpetViews(recs);
    const all = DEFAULT_STATUS_FILTER;
    expect(filterCarpets(views, { q: 'kashan', size: sizeKey(carpet()), statuses: all }).map((v) => v.carpet.entityId)).toEqual(['kashan']);
    expect(filterCarpets(views, { q: 'KASHAN', statuses: ['in_stock', 'reserved', 'delivered', 'sold', 'written_off'] }).map((v) => v.carpet.entityId).sort()).toEqual(['kashan', 'n1']);
    expect(filterCarpets(views, { q: 'bh-0043', statuses: all }).map((v) => v.carpet.entityId)).toEqual(['p43']);
    expect(filterCarpets(views, { statuses: ['reserved'] }).map((v) => v.carpet.entityId)).toEqual(['kashan']);
    expect(filterCarpets(views, { design: 'bokhara', statuses: all }).map((v) => v.carpet.entityId)).toEqual(['p43']);
    expect(filterCarpets(views, { minPricePaise: 3_000_000, statuses: all }).map((v) => v.carpet.entityId)).toEqual(['kashan']);
    expect(filterCarpets(views, { maxPricePaise: 2_500_000, statuses: all }).map((v) => v.carpet.entityId)).toEqual(['p43']);
    const opts = filterOptions(views);
    expect(opts.designs).toEqual(['Bokhara', 'Kashan 101', 'Nain']);
    expect(opts.sizes.map((s) => s.label)).toEqual(['5 × 8 ft', '6 × 9 ft', '8 × 10 ft']);
  });
});

describe('AC10–AC14: release, sold directly, written off, limits, reversal', () => {
  const afterAC5 = () => {
    const res = rec<CarpetReserveP>('carpet_reserve', { carpetId: 'kashan', orderId: 'ord1', qty: 3 });
    return { res, recs: [...base(), res, rec<DeliveryP>('delivery', { orderId: 'ord1', qty: 2, carpetId: 'kashan' })] };
  };
  it('AC10: releasing a reservation (reversal with a reason) puts the rest back in stock', () => {
    const { res, recs } = afterAC5();
    const released = [...recs, rec<ReversalP>('reversal', { targetId: res.id, reason: 'ऑर्डर बदला' })];
    expect(counts(released)).toMatchObject({ reserved: 0, delivered: 2, inStock: 3 });
  });
  it('AC11: sold directly 1 (no order) → in stock 1, sold 1', () => {
    const { recs } = afterAC5();
    expect(moveError(recs, 'carpet_out', { carpetId: 'kashan', qty: 1, note: 'दुकान पर बेचा' })).toBe('');
    const sold = [...recs, rec<CarpetOutP>('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'sold', note: 'दुकान पर बेचा' }, '2026-11-01')];
    expect(counts(sold)).toMatchObject({ inStock: 1, sold: 1, reserved: 1 });
    expect(carpetHistory(sold, 'kashan')[0]).toMatchObject({ kind: 'sold', qty: 1, note: 'दुकान पर बेचा' });
  });
  it('AC12: written off → in stock 0; a written-off piece is hidden by default, shown with its filter', () => {
    const { recs } = afterAC5();
    const out = [...recs, rec<CarpetOutP>('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'sold', note: 'x' }), rec<CarpetOutP>('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'written_off', note: 'पानी से ख़राब' })];
    expect(counts(out)).toMatchObject({ inStock: 0, writtenOff: 1 });
    const piece = [rec('carpet', carpet({ entityId: 'p43', mode: 'piece', tag: 'BH-0043' })), rec<CarpetInP>('carpet_in', { carpetId: 'p43', qty: 1 }), rec<CarpetOutP>('carpet_out', { carpetId: 'p43', qty: 1, kind: 'written_off', note: 'फटा' })];
    const views = carpetViews(piece);
    expect(views[0].status).toBe('written_off');
    expect(filterCarpets(views, { statuses: DEFAULT_STATUS_FILTER })).toEqual([]);
    expect(filterCarpets(views, { statuses: ['written_off'] }).length).toBe(1);
  });
  it('AC13: no note → note_required; more than in stock → refused; reserved carpets must be released first', () => {
    const { recs } = afterAC5(); // in stock 2, reserved 1
    expect(moveError(recs, 'carpet_out', { carpetId: 'kashan', qty: 1, note: ' ' })).toBe('note_required');
    expect(moveError(recs, 'carpet_out', { carpetId: 'kashan', qty: 3, note: 'x' })).toBe('insufficient_stock');
    const one = [...recs, rec<CarpetOutP>('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'sold', note: 'x' })];
    expect(moveError(one, 'carpet_out', { carpetId: 'kashan', qty: 2, note: 'x' })).toBe('insufficient_stock');
    const none = [...one, rec<CarpetOutP>('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'sold', note: 'x' })];
    expect(counts(none)).toMatchObject({ inStock: 0, reserved: 1 });
    expect(moveError(none, 'carpet_out', { carpetId: 'kashan', qty: 1, note: 'x' })).toBe('insufficient_stock'); // the reserved one
  });
  it('AC14: reversing the sale puts the carpet back in stock; history keeps both', () => {
    const { recs } = afterAC5();
    const sale = rec<CarpetOutP>('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'sold', note: 'दुकान पर बेचा' });
    const rev = rec<ReversalP>('reversal', { targetId: sale.id, reason: 'ग़लती से दर्ज' });
    const all = [...recs, sale, rev];
    expect(counts(all)).toMatchObject({ inStock: 2, sold: 0 });
    const h = carpetHistory(all, 'kashan');
    expect(h[0]).toMatchObject({ kind: 'sold', reversal: { id: rev.id } });
  });
});
