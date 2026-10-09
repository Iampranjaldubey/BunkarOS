// Bunkar OS — shared data contract. ALL modules import types from here.
// Units: lengths in INCHES (number, may be fractional), weights in GRAMS (integer),
// money in PAISE (integer), area in SQ FT rounded to 2 dp (number).
// Every write is an append-only Rec. Edits of masters = new version (same entityId).
// Corrections = 'reversal' record. Nothing is ever hard-deleted (N1, M3).

export type Role = 'owner' | 'munshi' | 'thekedar';
export type SyncState = 'pending' | 'synced' | 'rejected';
export type PayMode = 'cash' | 'upi';
export type Lang = 'hi' | 'en';

export type RecordType =
  | 'user' | 'loom' | 'thekedar' | 'weaver' | 'order'
  | 'piece_assign' | 'piece_status'
  | 'rate' | 'norm' | 'setting'
  | 'yarn_issue' | 'yarn_return'
  | 'bazaar' | 'peshgi' | 'checkin' | 'roker'
  | 'slip' | 'slip_response'
  | 'job'                // C2 ancillary work paid by kg / day / piece (untying, straightening, helpers)
  | 'reversal';

export interface Rec<P = unknown> {
  id: string;            // uuid v4, client generated
  type: RecordType;
  unitId: string;
  payload: P;
  by: string;            // userId of author ('weaver:<id>' for slip_response from server)
  role: Role | 'weaver' | 'system';
  device: string;        // device id (localStorage)
  at: string;            // ISO timestamp (UTC)
  day: string;           // YYYY-MM-DD in Asia/Kolkata
  sync: SyncState;
  serverSeq?: number;
  rejectReason?: string;
  photoIds?: string[];   // photos attached to this record (M5)
}

// ---------- masters (versioned by entityId; latest `at` wins) ----------
export interface UserP { entityId: string; name: string; phone: string; role: Role; pinHash: string; pinSalt: string; thekedarId?: string; active: boolean; }
export interface LoomP { entityId: string; code: string; village: string; widthIn: number; thekedarId?: string; weaverIds: string[]; lat?: number; lng?: number; photoId?: string; active: boolean; }
export interface ThekedarP { entityId: string; name: string; phone: string; village: string; photoId?: string; active: boolean; }
export type PhoneType = 'smartphone' | 'keypad' | 'shared';
export interface WeaverP { entityId: string; name: string; fatherName: string; village: string; phone: string; phoneType: PhoneType; upi?: string; loomId?: string; photoId?: string; active: boolean; }
export interface OrderP {
  entityId: string; orderNo: string; exporter: string; design: string; quality: string; colour: string;
  lengthIn: number; widthIn: number; count: number; dueDate?: string;
  pieces: { pieceId: string; seq: number }[];   // pieceId = `${orderNo}/${seq padded 2}`
}
// Weaving (bazaar) rates use sqft | sqgaj | piece. Ancillary job rates use kg | day | piece (C2).
export type RateUnit = 'sqft' | 'sqgaj' | 'piece' | 'kg' | 'day';   // 1 sq gaj = 9 sq ft
export type WorkKind = 'weaving' | 'untying' | 'straightening' | 'helper' | 'other';
export interface RateP {
  entityId: string;
  quality: string;            // carpet quality for weaving rates; '' for job rates
  unit: RateUnit;
  ratePaise: number;
  effectiveFrom: string;      // YYYY-MM-DD
  work?: WorkKind;            // absent = 'weaving' (back-compat with P0 records)
}
export interface NormP { entityId: string; quality: string; gramsPerSqft: number; }
export interface SettingP {
  entityId: 'unit';                                 // single settings entity
  unitName: string; ownerPhone: string; lang: Lang;
  photoRequiredAbovePaise: number;                  // D4 default 200000 (₹2,000)
  wastagePct: number;                               // D1 default 3
  idleYellowDays: number; idleRedDays: number;      // D9 defaults 4 / 7
  openingCashPaise: number; openingCashDay: string; // roker start
}

// ---------- transactions ----------
export interface PieceAssignP { pieceId: string; loomId: string; weaverId?: string; }
export interface PieceStatusP { pieceId: string; status: 'delivered' | 'on_hold' | 'resumed'; note?: string; }
export type Holder = { kind: 'loom'; loomId: string; pieceId?: string } | { kind: 'thekedar'; thekedarId: string };
export interface YarnIssueP { holder: Holder; shade: string; lot: string; grams: number; }
export interface YarnReturnP { holder: Holder; shade: string; lot: string; grams: number; }
export interface Deduction { reason: string; amountPaise: number; photoId: string; }
export type TauliCause = 'moisture' | 'less_wool_returned' | 'wrong_weighing' | 'other';
export interface TauliResult {
  issuedG: number; returnedG: number; usedG: number; wastagePct: number;
  allowedG: number; gapG: number; shortG: number; extraG: number;
  normGPerSqft?: number; expectedG?: number;
  cause?: TauliCause; weaverAck?: boolean;
}
export interface BazaarP {
  pieceId: string; loomId: string; weaverId: string; thekedarId?: string;
  lengthIn: number; widthIn: number; areaSqft: number; carpetGrams: number;
  rateId: string; ratePaise: number; rateUnit: RateUnit;
  grossPaise: number; deductions: Deduction[]; peshgiRecoveredPaise: number;
  netPaise: number; paidPaise: number; roundingPaise: number;
  payment: { cashPaise: number; upiPaise: number };
  tauli: TauliResult;
}
export interface PeshgiP { personKind: 'weaver' | 'thekedar'; personId: string; amountPaise: number; mode: PayMode; note?: string; }
export interface CheckinP { pieceId: string; loomId: string; wovenIn: number; lat?: number; lng?: number; }
export type RokerHead = 'kharcha' | 'dyer' | 'transport' | 'wool_purchase' | 'receipt' | 'misc';
export interface RokerP { dir: 'in' | 'out'; mode: PayMode; amountPaise: number; head: RokerHead; note?: string; }
export interface SlipP {
  token: string;                // 128-bit random, base64url — public link key
  kind: 'bazaar' | 'peshgi';
  sourceId: string;             // bazaar or peshgi record id
  weaverId: string; weaverName: string; weaverPhone: string;
  textHi: string; textEn: string;   // full slip text shown on screen / sent on WhatsApp
  speechHi?: string;                // C9 spoken script (numbers in Hindi words) for TTS + server audio clip
  lines: { label: string; amountPaise?: number; value?: string; sign?: '+' | '-' }[];
}
export interface SlipResponseP { token: string; slipId: string; answer: 'agree' | 'dispute'; note?: string; }
export interface ReversalP { targetId: string; reason: string; }

// C2 ancillary work payment. Exactly one quantity field is set, matching `unit`:
// kg → grams (integer), day → days (multiple of 0.5), piece → count (integer ≥ 1).
// amountPaise = round(qty × ratePaise); paidPaise = half-up rupee of amount; cash + upi = paid.
export interface JobP {
  workerKind: 'weaver' | 'thekedar' | 'other';
  workerId?: string;          // weaver/thekedar entityId (absent for 'other')
  workerName?: string;        // required for 'other' (day-rate helper not in the registry)
  work: Exclude<WorkKind, 'weaving'>;
  unit: 'kg' | 'day' | 'piece';
  grams?: number; days?: number; count?: number;
  rateId: string; ratePaise: number;
  amountPaise: number; paidPaise: number; roundingPaise: number;
  payment: { cashPaise: number; upiPaise: number };
  note?: string;
}

export interface PhotoRow { id: string; unitId: string; blob: Blob; mime: string; w: number; h: number; at: string; sync: SyncState; }
