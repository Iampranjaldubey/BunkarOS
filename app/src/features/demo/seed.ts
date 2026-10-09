// Bunkar OS — demo data seeder (owned by the demo + E2E harness agent).
//
// Bulk-inserts a realistic, fully backdated Bhadohi carpet unit directly into
// IndexedDB (sync:'pending', authored by the current owner). The seed is
// idempotent: a marker `setting` with a seeded flag short-circuits re-runs.
//
// It is designed so the owner loom board shows EXACTLY:
//   17 on-track / 3 slow / 3 idle / 1 free   (24 looms total)
// matching SPEC-000/012/013 and the A2 exporter mock legend. The C3/E2 bazaar
// demo numbers line up (piece EX-118/03: two 12 kg issues → 24.000 kg given,
// the live demo issues the *second* 12 kg).
//
// Writes go straight to db.records.bulkPut (not addRecord) because we need to
// control `at`/`day` for backdating — addRecord always stamps "now".

import { db } from '../../db/db';
import type {
  Rec, RecordType, Role,
  LoomP, WeaverP, ThekedarP, OrderP, RateP, NormP, SettingP,
  PieceAssignP, CheckinP, YarnIssueP, YarnReturnP, PeshgiP, BazaarP, SlipP,
  TauliResult, Holder, RokerP,
} from '../../db/types';
import { uuid, istDay } from '../../domain/ids';
import { areaSqft } from '../../domain/units';
import { rupeesToPaise, roundToRupee } from '../../domain/money';
import { getStoredSession, getDeviceId } from '../../lib/session-store';
import { makeAvatarPhoto } from './avatars';

const SEED_MARKER = 'bunkar.demo.seeded';

// ---------------------------------------------------------------------------
// Date helpers (all backdated relative to "now").
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO timestamp `n` days ago, at ~10:30 IST (05:00 UTC) + optional minutes. */
function daysAgoISO(n: number, minuteOffset = 0): string {
  const t = Date.now() - n * DAY_MS;
  const d = new Date(t);
  // Normalise to a stable mid-morning IST slot so `day` is deterministic.
  d.setUTCHours(5, 0 + minuteOffset, 0, 0);
  return d.toISOString();
}

function dayAgo(n: number): string {
  return istDay(daysAgoISO(n));
}

// ---------------------------------------------------------------------------
// Record builder.
// ---------------------------------------------------------------------------

interface Author {
  by: string;
  role: Role;
  unitId: string;
  device: string;
}

function rec<P>(
  author: Author,
  type: RecordType,
  payload: P,
  daysAgo: number,
  minuteOffset = 0,
  photoIds?: string[],
): Rec<P> {
  const at = daysAgoISO(daysAgo, minuteOffset);
  return {
    id: uuid(),
    type,
    unitId: author.unitId,
    payload,
    by: author.by,
    role: author.role,
    device: author.device,
    at,
    day: istDay(at),
    sync: 'pending',
    ...(photoIds && photoIds.length ? { photoIds } : {}),
  };
}

// ---------------------------------------------------------------------------
// Demo content.
// ---------------------------------------------------------------------------

const VILLAGES = ['Rampur', 'Bhanpur', 'Gopiganj', 'Aurai'];

// 24 weaver names — includes three "Mohammad Rafiq" sharing the name with
// different fathers (a real Bhadohi disambiguation problem), plus Rafiq Ansari
// (the demo weaver on loom 7).
const WEAVERS: { name: string; father: string; phoneType: WeaverP['phoneType'] }[] = [
  { name: 'Rafiq Ansari', father: 'Abdul Ansari', phoneType: 'smartphone' },
  { name: 'Mohammad Rafiq', father: 'Nazir Ahmad', phoneType: 'keypad' },
  { name: 'Mohammad Rafiq', father: 'Shakeel Ahmad', phoneType: 'shared' },
  { name: 'Mohammad Rafiq', father: 'Iqbal Hussain', phoneType: 'keypad' },
  { name: 'Imran Ali', father: 'Yusuf Ali', phoneType: 'smartphone' },
  { name: 'Shabnam Begum', father: 'Rashid Khan', phoneType: 'shared' },
  { name: 'Jamil Ahmad', father: 'Haroon Ahmad', phoneType: 'keypad' },
  { name: 'Nasreen Bano', father: 'Aslam Khan', phoneType: 'shared' },
  { name: 'Salim Khan', father: 'Karim Khan', phoneType: 'smartphone' },
  { name: 'Arif Hussain', father: 'Zahid Hussain', phoneType: 'keypad' },
  { name: 'Firoz Alam', father: 'Mahtab Alam', phoneType: 'smartphone' },
  { name: 'Rehana Khatoon', father: 'Idris Ahmad', phoneType: 'shared' },
  { name: 'Wasim Akram', father: 'Nadeem Akhtar', phoneType: 'keypad' },
  { name: 'Shahid Raza', father: 'Ghulam Raza', phoneType: 'smartphone' },
  { name: 'Parveen Bano', father: 'Sattar Khan', phoneType: 'shared' },
  { name: 'Tabrez Alam', father: 'Shamshad Alam', phoneType: 'keypad' },
  { name: 'Noor Mohammad', father: 'Hamid Ali', phoneType: 'smartphone' },
  { name: 'Gulfam Ansari', father: 'Rafique Ansari', phoneType: 'keypad' },
  { name: 'Asif Iqbal', father: 'Javed Iqbal', phoneType: 'smartphone' },
  { name: 'Shahnaz Begum', father: 'Mukhtar Ahmad', phoneType: 'shared' },
  { name: 'Danish Ali', father: 'Shaukat Ali', phoneType: 'keypad' },
  { name: 'Rizwan Khan', father: 'Ayub Khan', phoneType: 'smartphone' },
  { name: 'Sabina Khatoon', father: 'Mehboob Alam', phoneType: 'shared' },
  { name: 'Ejaz Ahmad', father: 'Rafiq Ahmad', phoneType: 'keypad' },
];

function phoneFor(i: number): string {
  // Deterministic, obviously-fake 10-digit numbers starting 98/99.
  const base = 9800000000 + i * 111111;
  return String(base).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Tauli for the demo bazaars (D1: wastage base = used wool).
// ---------------------------------------------------------------------------

function tauliFor(issuedG: number, returnedG: number, carpetG: number, wastagePct: number, area: number, normG?: number): TauliResult {
  const usedG = issuedG - returnedG;
  const allowedG = Math.round((usedG * wastagePct) / 100);
  const gapG = usedG - carpetG;
  const shortG = Math.max(0, gapG - allowedG);
  const extraG = Math.max(0, carpetG - usedG);
  return {
    issuedG, returnedG, usedG, wastagePct, allowedG, gapG, shortG, extraG,
    normGPerSqft: normG,
    expectedG: normG ? Math.round(normG * area) : undefined,
    cause: shortG > 0 ? 'less_wool_returned' : undefined,
    weaverAck: true,
  };
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

/** True once the demo seed has run for the active unit. */
export async function isDemoLoaded(): Promise<boolean> {
  const marker = await db.meta.get(SEED_MARKER);
  if (marker?.value) return true;
  // Fallback: a loom coded "01".."24" with our demo village set is a strong tell.
  const session = getStoredSession();
  if (!session) return false;
  const some = await db.records
    .where('unitId').equals(session.unitId)
    .filter((r) => r.type === 'order' && (r.payload as OrderP).orderNo === 'EX-118')
    .first();
  return Boolean(some);
}

/**
 * Seed a realistic demo unit for the CURRENT session's owner. Idempotent.
 * Must be called while logged in as an owner.
 */
export async function loadDemoData(): Promise<void> {
  const session = getStoredSession();
  if (!session) throw new Error('loadDemoData: no active session');
  if (session.role !== 'owner') throw new Error('loadDemoData: owner only');
  if (await isDemoLoaded()) return;

  const author: Author = {
    by: session.userId,
    role: 'owner',
    unitId: session.unitId,
    device: getDeviceId(),
  };

  const records: Rec[] = [];

  // --- settings: opening cash Rs 42,500 (effective 3 days ago), owner phone -
  // Stamp this record at the TRUE current instant so it beats the `setting`
  // record the setup flow wrote at unit creation (latestEntities picks max
  // `at`). Our day-normalized "0 days ago" helper lands at 05:00 UTC which can
  // actually be *earlier* than setup's real timestamp — so use Date.now() here.
  const setting: SettingP = {
    entityId: 'unit',
    unitName: 'Ansari Carpets',
    ownerPhone: '9876543210',
    lang: 'hi',
    photoRequiredAbovePaise: 200_000,
    wastagePct: 3,
    idleYellowDays: 4,
    idleRedDays: 7,
    openingCashPaise: rupeesToPaise(42_500),
    openingCashDay: dayAgo(3),
  };
  const nowISO = new Date().toISOString();
  records.push({
    id: uuid(),
    type: 'setting',
    unitId: author.unitId,
    payload: setting,
    by: author.by,
    role: author.role,
    device: author.device,
    at: nowISO,
    day: istDay(nowISO),
    sync: 'pending',
  } as Rec<SettingP>);

  // --- rates (D2 lock test): ₹38 effective 60 days ago, ₹40 from 5 days -
  const QUALITY = 'Kashan 60 KPSI';
  records.push(
    rec<RateP>(author, 'rate', {
      entityId: uuid(), quality: QUALITY, unit: 'sqft',
      ratePaise: rupeesToPaise(38), effectiveFrom: dayAgo(60),
    }, 60),
  );
  records.push(
    rec<RateP>(author, 'rate', {
      entityId: uuid(), quality: QUALITY, unit: 'sqft',
      ratePaise: rupeesToPaise(40), effectiveFrom: dayAgo(5),
    }, 5),
  );
  // norm 300 g/sqft
  records.push(
    rec<NormP>(author, 'norm', { entityId: uuid(), quality: QUALITY, gramsPerSqft: 300 }, 60),
  );

  // --- C2 job rates (ancillary work; quality '' , work set), 60 days ago --
  // Straightening ₹7/kg, untying ₹10/kg, helper ₹350/day. These feed the
  // munshi "दूसरा काम" entry (owned by c2) and the monthly wage bill.
  records.push(
    rec<RateP>(author, 'rate', {
      entityId: uuid(), quality: '', unit: 'kg',
      ratePaise: rupeesToPaise(7), effectiveFrom: dayAgo(60), work: 'straightening',
    }, 60),
    rec<RateP>(author, 'rate', {
      entityId: uuid(), quality: '', unit: 'kg',
      ratePaise: rupeesToPaise(10), effectiveFrom: dayAgo(60), work: 'untying',
    }, 60),
    rec<RateP>(author, 'rate', {
      entityId: uuid(), quality: '', unit: 'day',
      ratePaise: rupeesToPaise(350), effectiveFrom: dayAgo(60), work: 'helper',
    }, 60),
  );

  // --- thekedars ----------------------------------------------------------
  const shamimId = uuid();
  const salimId = uuid();
  const shamimPhoto = await makeAvatarPhoto('Shamim', 'thekedar');
  const salimPhoto = await makeAvatarPhoto('Salim', 'thekedar');
  records.push(
    rec<ThekedarP>(author, 'thekedar', {
      entityId: shamimId, name: 'Shamim', phone: '9811122233', village: 'Gopiganj',
      photoId: shamimPhoto ?? undefined, active: true,
    }, 58),
    rec<ThekedarP>(author, 'thekedar', {
      entityId: salimId, name: 'Salim', phone: '9822233344', village: 'Aurai',
      photoId: salimPhoto ?? undefined, active: true,
    }, 58),
  );

  // --- weavers (24) + photos ---------------------------------------------
  const weaverIds: string[] = [];
  for (let i = 0; i < WEAVERS.length; i++) {
    const w = WEAVERS[i];
    const id = uuid();
    weaverIds.push(id);
    const photo = await makeAvatarPhoto(w.name, 'weaver');
    const payload: WeaverP = {
      entityId: id,
      name: w.name,
      fatherName: w.father,
      village: VILLAGES[i % VILLAGES.length],
      phone: phoneFor(i),
      phoneType: w.phoneType,
      upi: w.phoneType === 'smartphone' ? `${w.name.split(' ')[0].toLowerCase()}@okaxis` : undefined,
      photoId: photo ?? undefined,
      active: true,
    };
    records.push(rec<WeaverP>(author, 'weaver', payload, 55, i));
  }
  const rafiqAnsariId = weaverIds[0]; // demo weaver — weaves ONLY on loom 07.

  // The default loom→weaver mapping is loom index i → weaver index i, with ONE
  // deliberate swap: Rafiq Ansari (weaver 0) must weave ONLY on loom 07 (index
  // 6), because he holds the demo peshgi recovered in the EX-118/03 bazaar.
  // So loom 07 takes Rafiq (weaver 0) and loom 01 (index 0) takes the weaver
  // that index 6 would otherwise have (Jamil Ahmad). Every weaver still appears
  // on exactly one loom; Rafiq appears on loom 07 and nowhere else.
  const DEMO_LOOM_IDX = 6; // loom code "07"
  const weaverForLoom = (li: number): string => {
    if (li === DEMO_LOOM_IDX) return weaverIds[0];       // loom 07 → Rafiq
    if (li === 0) return weaverIds[DEMO_LOOM_IDX];         // loom 01 → Jamil (frees Rafiq)
    return weaverIds[li];
  };

  // --- looms (24, codes 01..24) + photos ---------------------------------
  const loomIds: string[] = [];
  for (let i = 0; i < 24; i++) {
    const id = uuid();
    loomIds.push(id);
    const code = String(i + 1).padStart(2, '0');
    const photo = await makeAvatarPhoto(code, 'loom');
    // Looms 1-12 under Shamim (Gopiganj area), 13-24 under Salim (Aurai area).
    const thekedarId = i < 12 ? shamimId : salimId;
    const payload: LoomP = {
      entityId: id,
      code,
      village: VILLAGES[i % VILLAGES.length],
      widthIn: 120 + (i % 3) * 12,
      thekedarId,
      weaverIds: [weaverForLoom(i)],
      photoId: photo ?? undefined,
      active: true,
    };
    records.push(rec<LoomP>(author, 'loom', payload, 54, i));
  }
  const loom7Id = loomIds[6]; // EX-118/03 lives on loom 7 (code "07")

  // --- orders -------------------------------------------------------------
  // EX-118 'Kashan 14' 12 pieces 8'0"x10'0" for Sharma Exports.
  const lenIn = 96; // 8'0"
  const widIn = 120; // 10'0"
  const order118 = makeOrder('EX-118', 'Sharma Exports', 'Kashan 14', QUALITY, 'Ivory/Blue', lenIn, widIn, 12);
  records.push(rec<OrderP>(author, 'order', order118, 50));

  // EX-121 6 pieces for Sharma Exports. Due within 14 days → shows as an
  // "order at risk" in the K1 digest (PRD example: "Order at risk: EX-121").
  // dayAgo(-7) = 7 days ahead, which is >= today (not overdue) and inside the
  // 14-day RISK_DUE_DAYS window → digest reason 'due_soon'.
  const order121 = makeOrder('EX-121', 'Sharma Exports', 'Bidjar 12', QUALITY, 'Rust/Gold', 108, 144, 6);
  order121.dueDate = dayAgo(-7);
  records.push(rec<OrderP>(author, 'order', order121, 48));

  // EX-125 10 pieces for Mirzapur Rugs (fills the board + supplies bazaars).
  const order125 = makeOrder('EX-125', 'Mirzapur Rugs', 'Heriz 10', QUALITY, 'Red/Navy', 84, 120, 10);
  records.push(rec<OrderP>(author, 'order', order125, 46));

  // Flat list of all 28 pieces in a stable order.
  const allPieces = [...order118.pieces, ...order121.pieces, ...order125.pieces]
    .map((p) => p.pieceId);

  // Per-piece carpet length (inches) — needed for the "free in 30 days" pace
  // estimate (loomsFreeSoon) and the no_wool wool-remaining estimate.
  const lenByPiece = new Map<string, number>();
  for (const p of order118.pieces) lenByPiece.set(p.pieceId, lenIn);
  for (const p of order121.pieces) lenByPiece.set(p.pieceId, 108);
  for (const p of order125.pieces) lenByPiece.set(p.pieceId, 84);

  // --- board assignment plan ---------------------------------------------
  // 24 looms. Loom 24 (index 23) carries an on_loom EX-125 piece with NO wool
  // issued → status 'no_wool' (SPEC-017). Looms 1-23 each get one on_loom piece
  // with GENEROUS wool (so the wool-remaining estimate never flips them to
  // no_wool) and a backdated check-in whose "last progress" day decides colour:
  //   on_track (17): progress 1 day ago
  //   slow      (3): progress 5 days ago
  //   idle      (3): progress 9 days ago
  // Loom 7 (index 6) carries EX-118/03 and is on_track.
  //
  // Board source of truth = SPEC-017 PRD demo grid:
  //   17 on-track / 3 slow / 3 idle / 1 no wool / 0 free.
  //
  // 3 completed bazaars on EX-125/01..03 are assigned to loom 24 as OFF-loom
  // (they already have a bazaar), so they don't make loom 24 "busy"; loom 24's
  // on_loom (no-wool) piece decides its status.

  const onTrackLoomIdx = [...range(0, 24)].filter((i) => i !== 23).slice(0, 17); // 17 looms
  const slowLoomIdx = [...range(0, 24)].filter((i) => i !== 23 && !onTrackLoomIdx.includes(i)).slice(0, 3);
  const idleLoomIdx = [...range(0, 24)].filter(
    (i) => i !== 23 && !onTrackLoomIdx.includes(i) && !slowLoomIdx.includes(i),
  ).slice(0, 3);
  // Sanity: 17 + 3 + 3 = 23 looms busy, loom index 23 = no_wool.

  // On-track looms that we deliberately push close to completion so loomsFreeSoon
  // lists 4 looms as "free within 30 days" (SPEC-017 AC: free-soon card).
  const freeSoonIdx = [0, 1, 3, 4];

  // Ensure loom 7 (index 6) is in the on_track set and carries EX-118/03.
  // onTrackLoomIdx is indices 0..14 (excludes 23), which already includes 6.

  // Map each busy loom to a piece. Reserve EX-118/03 (seq 3 → index 2) for loom 7.
  const piece03 = order118.pieces[2].pieceId; // EX-118/03

  // Pieces available for assignment (exclude the 3 we'll bazaar on loom 24).
  const bazaarPieces = order125.pieces.slice(0, 3).map((p) => p.pieceId); // EX-125/01..03
  const assignablePieces = allPieces.filter((p) => p !== piece03 && !bazaarPieces.includes(p));

  let pieceCursor = 0;
  const nextPiece = () => assignablePieces[pieceCursor++];

  const busyLooms = [...onTrackLoomIdx, ...slowLoomIdx, ...idleLoomIdx];
  for (const li of busyLooms) {
    const isPiece03Loom = li === 6;
    const pieceId = isPiece03Loom ? piece03 : nextPiece();
    // The demo piece EX-118/03 must be woven by Rafiq Ansari (the demo weaver
    // who holds the ₹5,000 peshgi) so the walkthrough can recover ₹1,000 of it.
    // weaverForLoom guarantees Rafiq ONLY on loom 07 (loom 01 gets Jamil).
    const weaverId = weaverForLoom(li);
    const pieceLen = lenByPiece.get(pieceId) ?? 96;

    // Assignment ~44 days ago (well before any check-in).
    records.push(
      rec<PieceAssignP>(author, 'piece_assign', { pieceId, loomId: loomIds[li], weaverId }, 44, li),
    );

    // GENEROUS wool so the wool-remaining estimate never flips a busy loom to
    // no_wool (max full need across all qualities ~32.4 kg; 35 kg clears it).
    // EXCEPT the demo loom 7 (EX-118/03), which keeps EXACTLY its single seeded
    // 12 kg issue for the C3/E2 tauli walkthrough (its 54% woven keeps the
    // remaining estimate positive, so it stays on_track).
    if (!isPiece03Loom) {
      records.push(
        rec<YarnIssueP>(author, 'yarn_issue', {
          holder: { kind: 'loom', loomId: loomIds[li], pieceId }, shade: 'Red', lot: `W-${li}`, grams: 35_000,
        }, 43, li),
      );
    }

    // Decide last-progress day by bucket. Values sit squarely inside each band
    // (yellow=4, red=7) with a safe margin so ±1 day calendar drift from the
    // IST day boundary never flips a loom's status. Guarantees 17/3/3.
    let progressDaysAgo: number;
    if (onTrackLoomIdx.includes(li)) progressDaysAgo = 1;      // < 4  → on_track
    else if (slowLoomIdx.includes(li)) progressDaysAgo = 5;    // 4..6 → slow
    else progressDaysAgo = 9;                                  // >= 7 → idle

    // A couple of earlier check-ins + the decisive latest one, so % woven looks real.
    const woven1 = 24 + (li % 5) * 4; // inches
    records.push(
      rec<CheckinP>(author, 'checkin', {
        pieceId, loomId: loomIds[li], wovenIn: woven1,
      }, Math.min(progressDaysAgo + 12, 42), li),
    );
    // Free-soon looms are pushed to ~82% woven so loomsFreeSoon (pace over the
    // 44-day assignment age) projects them free well within 30 days.
    const woven2 = freeSoonIdx.includes(li)
      ? Math.round(pieceLen * 0.82)
      : woven1 + 18 + (li % 4) * 3;
    records.push(
      rec<CheckinP>(author, 'checkin', {
        pieceId, loomId: loomIds[li], wovenIn: woven2,
      }, progressDaysAgo, li),
    );
  }

  // --- loom 24 (index 23): on_loom EX-125 piece with NO wool → no_wool ----
  // SPEC-017 demo grid needs exactly ONE no-wool loom. Assign a fresh EX-125
  // piece to loom 24 and record a recent check-in (so it's clearly "active"),
  // but issue NO wool — the board rule marks it no_wool regardless of pace.
  const noWoolLoomIdx = 23;
  const noWoolPiece = nextPiece(); // next free EX-125 piece
  records.push(
    rec<PieceAssignP>(author, 'piece_assign', {
      pieceId: noWoolPiece, loomId: loomIds[noWoolLoomIdx], weaverId: weaverForLoom(noWoolLoomIdx),
    }, 6, noWoolLoomIdx),
  );
  records.push(
    rec<CheckinP>(author, 'checkin', {
      pieceId: noWoolPiece, loomId: loomIds[noWoolLoomIdx], wovenIn: 4,
    }, 1, noWoolLoomIdx),
  );

  // --- yarn issues --------------------------------------------------------
  // Demo piece EX-118/03: first issue 40 days ago, 12.000 kg red lot L-214.
  // (The live demo issues the SECOND 12 kg during the walkthrough.)
  const holder03: Holder = { kind: 'loom', loomId: loom7Id, pieceId: piece03 };
  records.push(
    rec<YarnIssueP>(author, 'yarn_issue', {
      holder: holder03, shade: 'Red', lot: 'L-214', grams: 12_000,
    }, 40),
  );

  // General yarn outside is now issued per-loom in the board loop above
  // (35 kg to every busy loom except the demo loom 7). We keep one
  // thekedar-held lot below for the D8 balance / "material outside" card.

  // Thekedar-held wool (D8 balance): Salim holds a lot.
  records.push(
    rec<YarnIssueP>(author, 'yarn_issue', {
      holder: { kind: 'thekedar', thekedarId: salimId }, shade: 'Gold', lot: 'L-240', grams: 15_000,
    }, 36),
  );
  records.push(
    rec<YarnReturnP>(author, 'yarn_return', {
      holder: { kind: 'thekedar', thekedarId: salimId }, shade: 'Gold', lot: 'L-240', grams: 4_000,
    }, 20),
  );

  // --- peshgi: ₹5,000 to Rafiq (cash) 30 days ago ------------------------
  records.push(
    rec<PeshgiP>(author, 'peshgi', {
      personKind: 'weaver', personId: rafiqAnsariId,
      amountPaise: rupeesToPaise(5_000), mode: 'cash', note: 'Festival advance',
    }, 30),
  );
  // A couple more peshgi for texture.
  records.push(
    rec<PeshgiP>(author, 'peshgi', {
      personKind: 'weaver', personId: weaverIds[4],
      amountPaise: rupeesToPaise(2_000), mode: 'upi', note: 'Loom repair',
    }, 25),
  );

  // --- TODAY's cash movements so the roker demo is reproducible -----------
  // Opening cash (settings.openingCashDay = 3 days ago) is ₹42,500 and nothing
  // between then and today moves cash (all other bazaars/peshgi are older), so
  // the opening chains cleanly to today. Today we seed exactly ₹8,000 of cash
  // out — Salim thekedar peshgi ₹2,000 (cash) + a dyer payment ₹6,000 (cash) —
  // so today's roker closes at ₹34,500 (SPEC-011 AC-1 / SPEC-012 AC-5). The
  // live demo bazaar is paid ₹1,955 via UPI, so it does not move cash closing.
  // Neither amount is ABOVE the ₹2,000 photo threshold (strictly >), so no
  // photo is required (D4).
  //
  // CRITICAL: stamp these at the TRUE current instant (nowISO), NOT via the
  // day-normalized daysAgoISO(0) helper. That helper forces 05:00 UTC which,
  // when the seed runs just after IST midnight (00:00–10:30 IST), rewinds to
  // the *previous* IST day — pushing today's cash-out into the opening chain
  // and making roker opening show ₹34,500 instead of ₹42,500. Using the real
  // instant guarantees `day === istDay(now)` whatever the wall-clock time.
  const todayDay = istDay(nowISO);
  records.push({
    id: uuid(), type: 'peshgi', unitId: author.unitId,
    payload: {
      personKind: 'thekedar', personId: salimId,
      amountPaise: rupeesToPaise(2_000), mode: 'cash', note: 'थेकेदार पेशगी',
    } as PeshgiP,
    by: author.by, role: author.role, device: author.device,
    at: nowISO, day: todayDay, sync: 'pending',
  } as Rec<PeshgiP>);
  records.push({
    id: uuid(), type: 'roker', unitId: author.unitId,
    payload: {
      dir: 'out', mode: 'cash', amountPaise: rupeesToPaise(6_000),
      head: 'dyer', note: 'रंगाई भुगतान',
    } as RokerP,
    by: author.by, role: author.role, device: author.device,
    at: nowISO, day: todayDay, sync: 'pending',
  } as Rec<RokerP>);

  // --- completed bazaars + slips on EX-125/01..03 (off-loom on loom 24) ---
  // A real photo for the seeded deduction so demo data obeys its own M5 rule
  // (every deduction needs photo evidence). Falls back to a non-empty marker
  // id in non-DOM environments where canvas is unavailable.
  const dedPhotoId = (await makeAvatarPhoto('Deduction', 'loom')) ?? uuid();
  const freeLoomId = loomIds[23];
  for (let b = 0; b < bazaarPieces.length; b++) {
    const pieceId = bazaarPieces[b];
    const weaverId = weaverIds[18 + b];
    const bazaarDaysAgo = 12 - b * 2;

    // These pieces use the EX-125 order dimensions (84 x 120).
    const L = 84, W = 120;
    const area = areaSqft(L, W); // 70.00 sqft
    const ratePaise = rupeesToPaise(38); // locked at first issue (older rate)
    const grossPaise = Math.round(area * ratePaise);
    const carpetGrams = 20_000 + b * 500;
    const issuedG = 22_000 + b * 500;
    const returnedG = 900 + b * 100;
    const tauli = tauliFor(issuedG, returnedG, carpetGrams, 3, area, 300);
    const peshgiRecoveredPaise = b === 0 ? rupeesToPaise(1_000) : 0;
    const deductions = b === 1
      ? [{ reason: 'धागा कम', amountPaise: rupeesToPaise(50), photoId: dedPhotoId }]
      : [];
    const dedTotal = deductions.reduce((s, d) => s + d.amountPaise, 0);
    const netPaise = grossPaise - dedTotal - peshgiRecoveredPaise;
    const { paid, rounding } = roundToRupee(netPaise);
    const rateId = uuid();

    const bazaar: BazaarP = {
      pieceId, loomId: freeLoomId, weaverId, thekedarId: salimId,
      lengthIn: L, widthIn: W, areaSqft: area, carpetGrams,
      rateId, ratePaise, rateUnit: 'sqft',
      grossPaise, deductions, peshgiRecoveredPaise,
      netPaise, paidPaise: paid, roundingPaise: rounding,
      payment: { cashPaise: paid, upiPaise: 0 },
      tauli,
    };
    // Need a yarn issue for these pieces so pieceYarn/tauli has data + rate lock.
    records.push(
      rec<YarnIssueP>(author, 'yarn_issue', {
        holder: { kind: 'loom', loomId: freeLoomId, pieceId }, shade: 'Red', lot: `L-25${b}`, grams: issuedG,
      }, bazaarDaysAgo + 20),
    );
    records.push(
      rec<YarnReturnP>(author, 'yarn_return', {
        holder: { kind: 'loom', loomId: freeLoomId, pieceId }, shade: 'Red', lot: `L-25${b}`, grams: returnedG,
      }, bazaarDaysAgo + 1),
    );
    const bazaarRec = rec<BazaarP>(
      author, 'bazaar', bazaar, bazaarDaysAgo, b,
      b === 1 ? [dedPhotoId] : undefined,
    );
    records.push(bazaarRec);

    // A slip for each completed bazaar.
    const slip: SlipP = {
      token: slipTokenLocal(),
      kind: 'bazaar',
      sourceId: bazaarRec.id,
      weaverId,
      weaverName: WEAVERS[18 + b].name,
      weaverPhone: phoneFor(18 + b),
      textHi: `${WEAVERS[18 + b].name} जी, कालीन ${pieceId} का हिसाब तैयार है।`,
      textEn: `${WEAVERS[18 + b].name} ji, slip for carpet ${pieceId} is ready.`,
      lines: [
        { label: 'कुल / Gross', amountPaise: grossPaise, sign: '+' },
        { label: 'दिया / Paid', amountPaise: paid },
      ],
    };
    records.push(rec<SlipP>(author, 'slip', slip, bazaarDaysAgo, b));
  }

  // --- persist ------------------------------------------------------------
  await db.records.bulkPut(records);
  await db.meta.put({ key: SEED_MARKER, value: { at: new Date().toISOString(), count: records.length } });
}

/**
 * Remove every record, photo and the seed marker for the active unit.
 * Used by the demo panel "clear" action and E2E teardown.
 */
export async function clearUnitData(): Promise<void> {
  const session = getStoredSession();
  if (!session) throw new Error('clearUnitData: no active session');
  const recs = await db.records.where('unitId').equals(session.unitId).toArray();
  const ids = recs.map((r) => r.id);
  const photoIds = recs.flatMap((r) => r.photoIds ?? []);
  await db.records.bulkDelete(ids);
  if (photoIds.length) await db.photos.bulkDelete(photoIds);
  // Drop any orphan photos for this unit too (photos table is not indexed by
  // unitId, so filter in-memory).
  const orphanPhotoIds = await db.photos
    .filter((p) => p.unitId === session.unitId)
    .primaryKeys();
  if (orphanPhotoIds.length) await db.photos.bulkDelete(orphanPhotoIds);
  await db.meta.delete(SEED_MARKER);
}

// ---------------------------------------------------------------------------
// Small local helpers (kept inside the demo folder — no new UI primitives).
// ---------------------------------------------------------------------------

function makeOrder(
  orderNo: string, exporter: string, design: string, quality: string, colour: string,
  lengthIn: number, widthIn: number, count: number,
): OrderP {
  const pieces = Array.from({ length: count }, (_, i) => ({
    pieceId: `${orderNo}/${String(i + 1).padStart(2, '0')}`,
    seq: i + 1,
  }));
  return {
    entityId: uuid(), orderNo, exporter, design, quality, colour,
    lengthIn, widthIn, count, pieces,
  };
}

function* range(start: number, end: number): Generator<number> {
  for (let i = start; i < end; i++) yield i;
}

/** 128-bit base64url token (local copy to avoid importing a non-owned util path churn). */
function slipTokenLocal(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
