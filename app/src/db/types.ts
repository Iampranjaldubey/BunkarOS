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
  pinHash: string; pinSalt: string; active: boolean;
}
export interface SettingP {
  entityId: 'unit';
  unitName: string; ownerPhone: string; lang: Lang;
  workingDaysPerMonth: number;        // default 26 (divisor for per-day deduction)
  photoRequiredAbovePaise: number;    // default 200000 (₹2,000)
  holidays: string[];                 // YYYY-MM-DD marked holiday (excluded from unmarked gaps)
  lowStockDefault?: number;           // optional default lowStockQty for new items (thousandths)
}

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
  snapshot: { present: number; half: number; absent: number; otHours: number; pieces: number; payType: PayType; ratePaise: number };
}
export interface PeriodLockP { month: string; }

// ---------- inventory ----------
export interface StockInP { itemId: string; qty: number; ratePaise?: number; supplier?: string; note?: string; }
export type StockOutPurpose = 'production' | 'sale' | 'other';
export interface StockOutP { itemId: string; qty: number; purpose: StockOutPurpose; workerId?: string; orderId?: string; note?: string; }
export type AdjustReason = 'wastage' | 'count_correction' | 'damage' | 'other';
export interface StockAdjustP { itemId: string; qtyDelta: number; reason: AdjustReason; note: string; }
export interface FinishedInP { itemId: string; qty: number; orderId?: string; }

// ---------- orders ----------
export type OrderStatus = 'new' | 'in_production' | 'finished' | 'delivered';
export interface OrderStatusP { orderId: string; status: OrderStatus; note?: string; }
export interface DeliveryP { orderId: string; qty: number; note?: string; finishedItemId?: string; }
export interface OrderNoteP { orderId: string; text: string; }

// ---------- meta ----------
export interface UsageP { screen: string; }
export interface ReversalP { targetId: string; reason: string; }

export interface PhotoRow { id: string; unitId: string; blob: Blob; mime: string; w: number; h: number; at: string; sync: SyncState; }
