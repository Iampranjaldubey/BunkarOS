// Bunkar MVP — shared data contract. Every module imports types from here.
// Money in integer PAISE. Quantities in integer THOUSANDTHS of the item's unit
// (grams for kg, pcs×1000 for pieces). Days 'YYYY-MM-DD' in Asia/Kolkata.
// Every write is an append-only Rec. Master edits = new version (same entityId).
// Corrections = 'reversal' record + (optionally) a fresh record. Nothing is deleted.

export type Role = 'owner' | 'staff';
export type SyncState = 'pending' | 'synced' | 'rejected';
export type PayMode = 'cash' | 'upi';
export type Lang = 'hi' | 'hin' | 'en';

export type RecordType =
  // masters (versioned by payload.entityId)
  | 'user' | 'setting' | 'worker' | 'item' | 'buyer' | 'order'
  // attendance + wages
  | 'attendance' | 'piece_entry' | 'advance' | 'wage_payment' | 'period_lock'
  // inventory
  | 'stock_in' | 'stock_out' | 'stock_adjust' | 'finished_in'
  // orders
  | 'order_status' | 'delivery' | 'order_note'
  // finished carpet catalogue (SPEC-M15): 'carpet' is a master (versioned by entityId)
  | 'carpet' | 'carpet_in' | 'carpet_reserve' | 'carpet_out'
  // meta
  | 'usage' | 'reversal';

export interface Rec<P = unknown> {
  id: string;            // uuid v4, client generated
  type: RecordType;
  unitId: string;
  payload: P;
  by: string;            // userId of author
  role: Role | 'system';
  device: string;        // device id (localStorage)
  at: string;            // ISO instant the record was written (UTC)
  day: string;           // business day YYYY-MM-DD (IST); may be back-dated
  sync: SyncState;
  serverSeq?: number;
  rejectReason?: string;
  photoIds?: string[];
  /** Set when this record replaces an earlier one the UI "edited" (the old one is reversed). */
  replaces?: string;
}

// ---------- masters ----------
export interface UserP {
  entityId: string; name: string; phone: string; role: Role;
  /** Only on a phone's own pending record (the server needs them once). Never pulled from the server (SPEC-M11). */
  pinHash?: string; pinSalt?: string; active: boolean;
}
export interface SettingP {
  entityId: 'unit';
  unitName: string; ownerPhone: string; lang: Lang;
  workingDaysPerMonth: number;        // default 26 (divisor for per-day deduction)
  photoRequiredAbovePaise: number;    // default 200000 (₹2,000)
  holidays: string[];                 // YYYY-MM-DD marked holiday (excluded from unmarked gaps)
  lowStockDefault?: number;           // optional default lowStockQty for new items (thousandths)
  // ---- SPEC-M13 unit rules (owner only). A missing field means its default (domain/settings.ts). ----
  overtimeEnabled?: boolean;          // D-001, default false
  offDayPolicy?: OffDayPolicy;        // D-002, default 'sundays_and_holidays'
  slipSections?: Partial<Record<SlipSection, boolean>>; // D-003
  operatorPerms?: Partial<OperatorPerms>;              // D-005 (all operators together)
}
export type OffDayPolicy = 'none' | 'sundays' | 'sundays_and_holidays';
/** Printed / WhatsApp slip sections (D-003). Rounding is not a section: it shows whenever it is not zero. */
export type SlipSection =
  | 'businessName' | 'workerName' | 'month' | 'gross' | 'advance' | 'deductions' | 'net' | 'signature'
  | 'attendance' | 'offDays' | 'pieces' | 'overtime' | 'rate' | 'ownerChanges' | 'advanceBalance' | 'payment';
/** D-005 operator toggles. `seeWages` stays true until server-side wage redaction exists (SPEC-M13 stage 2). */
export interface OperatorPerms { addEntries: boolean; editPast: boolean; seeWages: boolean; seePrices: boolean; export: boolean; }

export type PayType = 'monthly' | 'daily' | 'piece';
export type JobTitle = 'weaver' | 'finisher' | 'helper' | 'other';
export interface WorkerP {
  entityId: string; name: string; phone?: string; jobTitle: JobTitle;
  payType: PayType;
  salaryPaise?: number;      // monthly
  dailyRatePaise?: number;   // daily
  pieceRatePaise?: number;   // piece
  otRatePaise: number;       // per hour
  joinedOn: string; active: boolean; photoId?: string; note?: string;
  /** 4-digit code the worker types (with the shop code) to open their own page (SPEC-M07). */
  accessCode?: string;
}

export type ItemKind = 'raw' | 'finished';
export type ItemUnit = 'kg' | 'pcs' | 'litre' | 'metre';
export interface ItemP {
  entityId: string; name: string; kind: ItemKind; unit: ItemUnit;
  lowStockQty: number;       // thousandths; 0 = no flag
  active: boolean; note?: string;
}

export interface BuyerP { entityId: string; name: string; phone?: string; city?: string; active: boolean; }

export interface OrderP {
  entityId: string; buyerId: string; orderNo: string;
  design: string; size: string; qty: number; dueDate: string;
  pricePaise?: number; notes?: string; receivedOn: string;
}

// ---------- attendance + wages ----------
export type AttendanceStatus = 'present' | 'half' | 'absent';
export interface AttendanceP { workerId: string; status: AttendanceStatus; otHours: number; note?: string; }
export interface PieceEntryP { workerId: string; count: number; pieceRatePaise: number; note?: string; }
export interface AdvanceP { workerId: string; amountPaise: number; mode: PayMode; note?: string; }
export interface DeductionLine { label: string; amountPaise: number; }
export interface WagePaymentP {
  workerId: string; month: string;               // YYYY-MM
  grossPaise: number; otPaise: number;
  deductions: DeductionLine[];
  advanceRecoveredPaise: number;
  netPaise: number; paidPaise: number; roundingPaise: number;
  mode: PayMode; note?: string;
  // snapshot of the inputs for the slip (so a later attendance edit does not rewrite history)
  snapshot: WageSnapshot;
  /** SPEC-M14: lines the owner changed before paying. Totals above are the final amounts. */
  overrides?: WageOverride[];
  /** SPEC-M14: required when this worker already has a reversed payment for the month. */
  correctionReason?: string;
}
/** Wage lines the owner may override (SPEC-M14). Amounts are positive; deductions are subtracted. */
export type WageLineKey = 'base' | 'absent_deduct' | 'half_deduct' | 'days' | 'off_days' | 'pieces' | 'overtime' | 'advance_recovered' | 'rounding';
export interface WageOverride { line: WageLineKey; computedPaise: number; finalPaise: number; reason: string; }
/**
 * What the payment was computed from, saved with it. A paid month is shown only from this and the
 * payment's own totals (SPEC-M16 §1). Fields after `ratePaise` were added 2026-11-02; older payments lack them.
 */
export interface WageSnapshot {
  present: number; half: number; absent: number; otHours: number; pieces: number; payType: PayType; ratePaise: number;
  workingDays?: number; perDayPaise?: number; absentDeductPaise?: number; halfDeductPaise?: number;
  otRatePaise?: number; advanceOutstandingPaise?: number;
  // added 2026-11-02 (SPEC-M13/M14): rules in force and the computed amount of every line before overrides
  offDays?: number; offDayPolicy?: OffDayPolicy; overtimeEnabled?: boolean;
  parts?: Partial<Record<WageLineKey, number>>;
}
/** `reason` is required when the month was locked before (a re-lock after a correction, SPEC-M14). */
export interface PeriodLockP { month: string; reason?: string; }

// ---------- inventory ----------
export interface StockInP { itemId: string; qty: number; ratePaise?: number; supplier?: string; note?: string; }
export type StockOutPurpose = 'production' | 'sale' | 'other';
export interface StockOutP { itemId: string; qty: number; purpose: StockOutPurpose; workerId?: string; orderId?: string; note?: string; allowNegative?: true; overrideReason?: string; }
export type AdjustReason = 'wastage' | 'count_correction' | 'damage' | 'other';
export interface StockAdjustP { itemId: string; qtyDelta: number; reason: AdjustReason; note: string; allowNegative?: true; overrideReason?: string; }
export interface FinishedInP { itemId: string; qty: number; orderId?: string; }

// ---------- orders ----------
export type OrderStatus = 'new' | 'in_production' | 'finished' | 'delivered';
export interface OrderStatusP { orderId: string; status: OrderStatus; note?: string; }
/** `finishedItemId`: a legacy finished item (DM-004). `carpetId`: a catalogue carpet; the order's reservation of it is used first (SPEC-M15). */
export interface DeliveryP { orderId: string; qty: number; note?: string; finishedItemId?: string; carpetId?: string; }
export interface OrderNoteP { orderId: string; text: string; }

// ---------- finished carpet catalogue (SPEC-M15, D-006, DM-004) ----------
export type SizeUnit = 'ft' | 'm' | 'cm';
/** `piece`: one carpet with a unique tag. `quantity`: several identical carpets counted together. */
export type CarpetMode = 'piece' | 'quantity';
export interface CarpetP {
  entityId: string;
  design: string;                     // design name or code
  lengthMilli: number; widthMilli: number; sizeUnit: SizeUnit; // thousandths of the unit (8 ft = 8000)
  mode: CarpetMode;
  tag?: string;                       // piece mode only; unique among the unit's active carpets
  materialNotes?: string;
  costPaise?: number; pricePaise?: number; // removed by the server for operators while prices are hidden (SPEC-M13)
  notes?: string;
  photoIds: string[];                 // 0–4; the first is the cover
  active: boolean;
}
/** Carpets added to the catalogue (piece mode: exactly once, qty 1). */
export interface CarpetInP { carpetId: string; qty: number; note?: string; }
/** Carpets set aside for an order. A release is a reversal with a reason. */
export interface CarpetReserveP { carpetId: string; orderId: string; qty: number; note?: string; }
export type CarpetOutKind = 'sold' | 'written_off';
/** Sold directly or written off: no order, a note is required, the record's day is the date. */
export interface CarpetOutP { carpetId: string; qty: number; kind: CarpetOutKind; note: string; }

// ---------- meta ----------
export interface UsageP { screen: string; }
export interface ReversalP { targetId: string; reason: string; }

export interface PhotoRow { id: string; unitId: string; blob: Blob; mime: string; w: number; h: number; at: string; sync: SyncState; }
