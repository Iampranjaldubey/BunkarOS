# Bunkar OS — Specs

Spec index + template. Detailed specs may live in `docs/superpowers/specs/` — **index them here**.
No feature is built until its spec is **Approved**.

## Index
| ID | Title | PRD IDs | Status |
|----|-------|---------|--------|
| SPEC-000 | Demo loop overview | — | Approved |
| SPEC-001 | App shell, Hindi UI, roles + PIN login, audit log | M1/N2/N1 | Approved (goal 2026-10-09) |
| SPEC-002 | Offline queue + sync badge + photos | M3/M5 | Approved (goal 2026-10-09) |
| SPEC-003 | Loom & weaver registries (+ minimal thekedar) | B1/C1 | Approved (goal 2026-10-09) |
| SPEC-004 | Order → pieces, assign to loom, piece status | A1 | Approved (goal 2026-10-09) |
| SPEC-005 | Yarn issue/return + balances + material outside | E1 | Approved (goal 2026-10-09) |
| SPEC-006 | Rate card (owner-only) + lock + norms | C2 | Approved (goal 2026-10-09) |
| SPEC-007 | Bazaar + tauli + deductions with photo | C3/E2 | Approved (goal 2026-10-09) |
| SPEC-008 | Peshgi give/recover + balance | C5 | Approved (goal 2026-10-09) |
| SPEC-009 | Slip text + voice via wa.me + public slip page | C8/C9 | Approved (goal 2026-10-09) |
| SPEC-010 | Check-in photo + length, % woven | B2 | Approved (goal 2026-10-09) |
| SPEC-011 | Roker cash/UPI auto-posting | O1 | Approved (goal 2026-10-09) |
| SPEC-012 | Owner home loom board + 8 pm digest share | K2/K1 | Approved (goal 2026-10-09) |
| SPEC-013 | Static exporter status mock | A2 | Approved (goal 2026-10-09) |

---

## Template (copy for each new spec)
```
### SPEC-NNN — <Title>
- **PRD feature IDs**:
- **Status**: Draft | Approved | Built
- **Problem**:
- **Users**:
- **Scope** — In (P0 lite):
- **Scope** — Out:
- **Data** (entities/fields):
- **Rules / Formulas**:
- **UI notes**: Hindi-first; big numerals; red=given / green=received
- **Acceptance criteria** (Given / When / Then):
- **Open questions**:
```

---

### SPEC-000 — Demo loop overview
- **PRD feature IDs**: —
- **Status**: Approved
- **Problem**: Capture the end-to-end demo narrative so build steps stay coherent and known data inconsistencies get resolved before coding.
- **Users**: Owner / munshi (demo), weaver (receives slips).
- **Scope — In**: The 6-step demo loop:
  1. Create order → split into pieces (A1)
  2. Issue yarn to weaver (E1)
  3. Weaver works; status check-in (B2)
  4. Bazaar: piece received back (C3)
  5. Tauli: weighment + wastage calc (E2)
  6. Roker/slip: ledger entry + slip to weaver (O1/C8/C9)
- **Scope — Out**: Multi-unit, payroll, exports (post-P0).
- **Known inconsistencies (must resolve)**:
  - Demo **issues 12 kg** but bazaar says **24.000 given** — reconcile quantities.
  - **3% wastage base unstated**: 0.687 = 3% of 22.900 used — confirm the base weight.
  - **Two tauli formulas** coexist: (a) wool-given based, (b) size × norm — pick one / define when each applies.
  - **Loom legend 15/5 vs grid 17/3** — numbers disagree; fix source of truth.
  - **Ordered 8'0"×10'0" vs measured 8'0"×9'11"** — EX-118 is *ordered* as 96×120 but the demo piece is *measured* at bazaar as 96×119; distinguish ordered spec from as-woven measurement.
- **Resolutions** (decisions D1–D9 in TASKS.md):
  - 12 kg vs 24 kg: demo seed issues **two** lots (12.000 + 12.000) to piece EX-118/03 so totals match 24.000.
  - Wastage base = used wool (D1): 24.000 − 1.100 = 22.900; 3% = 0.687; gap 22.900 − 21.600 = 1.300; short = 0.613 kg.
  - Tauli: primary = used wool vs carpet weight; size × norm shown as reference only.
  - Loom board: the **live `loomBoard` projection is the single source of truth**; the demo seed produces **17 on-track / 3 slow / 3 idle / 1 free**, and both the owner home board and the A2 exporter mock legend read from it (no hardcoded legend).
  - Ordered vs measured size: EX-118 is **ordered 12 pieces at 8'0"×10'0" (96×120)**; piece **EX-118/03 is measured 8'0"×9'11" (96×119)** at bazaar, giving area 79.33 sqft for the wage math.
- **Rules / Formulas**:
  - area_sqft = (L_in × W_in) / 144, 2 dp
  - gross_paise = round(area_sqft × rate_paise_per_sqft); rate locked at first wool issue (D2)
  - net_paise = gross − deductions − peshgi_recovered; paid = round to ₹1, diff shown on slip (D6)
  - roker cash/UPI entry = net paid only (D7)
  - Demo check: 79.33 × ₹38 = ₹3,014.54 gross; net = 3,014.54 − 60 − 1,000 = ₹1,954.54 → paid ₹1,955 (+₹0.46 rounding shown on slip)
- **UI notes**: Hindi-first; big numerals; red=given / green=received; kg 3 dp, sq ft 2 dp.
- **Acceptance criteria**: Given a seeded demo order, When the operator walks all 6 steps offline, Then ledger + slips reflect consistent quantities with no formula ambiguity.
- **Open questions**: see TASKS.md "Decisions needed".

---

### SPEC-001 — App shell, Hindi UI, roles + PIN login, audit log
- **PRD feature IDs**: M1 / N2 / N1
- **Status**: Approved (goal 2026-10-09)
- **Problem**: Owners/munshis on low-end Android need a Hindi-first PWA shell with safe role-based access and a tamper-evident history of every write.
- **Users**: Owner, munshi, thekedar.
- **Scope — In**: PWA shell (installable, offline splash); `/setup` (create unit + owner PIN, or join via unit code), `/login` (pick user by photo/name + 4-digit PIN); role homes (`/`); bottom nav per role; i18n `hi` default + `en` toggle (`t('key')`); session (`useSession`); append-only `Rec` model; `auditLog(recs)` view at `/audit`; permissions via `can(role, action)` and `visibleLoomIds`.
- **Scope — Out**: Password reset flows, SSO, multi-unit switching. **Device binding ("one device per login", PRD N2) is deferred to P1** — P0 ships locked roles + per-user PIN + append-only audit, but does not enforce a one-device-per-user lock; a `device` id is stamped on every record for the audit trail only.
- **Data**: `UserP` (entityId,name,phone,role,pinHash,pinSalt,thekedarId?,active); `SettingP` (entityId:'unit', unitName, ownerPhone, lang, photoRequiredAbovePaise=200000, wastagePct=3, idleYellowDays=4, idleRedDays=7, openingCashPaise, openingCashDay). Every write = `Rec` with id/type/unitId/by/role/device/at/day/sync.
- **Rules / Formulas**: PIN = 4 digits, stored as `pinHash` with per-user `pinSalt` (never store PIN). Masters versioned by `entityId`, latest `at` wins; older = audit "old value". Reversal: munshi may reverse only same-`day` records he authored (`record.reverse.ownToday`); owner reverses anything (`record.reverse.any`). `auditLog` lists every record with author, role, time, and reversal/rejection state.
- **UI notes**: Hindi-first; base font 18 px; tap target ≥ 48 px; big tabular numerals; focus-visible rings; contrast ≥ 4.5:1.
- **Acceptance criteria**:
  1. Given no unit exists, When owner completes `/setup` with name + 4-digit PIN, Then a `user`(owner) + `setting` record are created and session starts on owner home.
  2. Given a unit exists, When a user picks their tile and enters the correct PIN, Then they land on their role home; wrong PIN shows a Hindi error and no session.
  3. Given lang=hi, When the user toggles to en, Then all visible strings switch via `t()` and the choice persists.
  4. Given a munshi authored a record today, When he opens it, Then "reverse" is offered; for a record from yesterday or another author, reverse is hidden.
  5. Given an owner, When he opens any record, Then reverse is always offered (N2).
  6. Given any master edited twice, When owner opens `/audit`, Then both versions appear with old→new values and timestamps.
  7. Given a thekedar logs in, When he opens home, Then only his looms (`visibleLoomIds`) are shown.
- **Open questions**: none (unit-join code format owned by foundation agent).

---

### SPEC-002 — Offline queue + sync badge + photos
- **PRD feature IDs**: M3 / M5
- **Status**: Approved (goal 2026-10-09)
- **Problem**: Connectivity is patchy; every action must be captured locally and reconciled with the server, with photos as evidence.
- **Users**: Owner, munshi, thekedar.
- **Scope — In**: `addRecord` saves `Rec{sync:'pending'}` to IndexedDB; `syncNow()`/`startAutoSync()` push on online event + every 30 s; `useSyncState()` → {pending, lastSyncAt, online, error}; header sync badge (pending count / synced / offline); photo capture → `savePhoto(file)` (compress ≤1280 px JPEG q≈0.7) → `PUT /api/photos/:id`; rejected records marked `rejected` with reason and shown in a "Rejected" list; projections ignore reversed + rejected.
- **Scope — Out**: Conflict-merge UI beyond reject/reverse; background push notifications.
- **Data**: `Rec.sync` ∈ {pending,synced,rejected}; `serverSeq`, `rejectReason`, `photoIds`; `PhotoRow{id,unitId,blob,mime,w,h,at,sync}`. `SettingP.photoRequiredAbovePaise` (D4 default 200000).
- **Rules / Formulas**: Photo mandatory for every deduction and write-off, and for payments/advances > `photoRequiredAbovePaise` (D4). Sync is idempotent by `id`. On `/api/sync` reject (e.g. second bazaar for a piece, non-owner rate edit) client sets `sync:'rejected'` + `rejectReason`. Only net paid posts to roker (D7).
- **UI notes**: Badge: amber "N बाक़ी" when pending, green "सिंक" when clear, grey "ऑफ़लाइन" offline. Red for given-out amounts, green for received.
- **Acceptance criteria**:
  1. Given offline, When a user saves any action, Then it persists with `sync:'pending'` and the badge shows the pending count; the action is fully usable in local projections.
  2. Given queued records and connectivity returns, When auto-sync runs, Then accepted records flip to `synced` and the badge clears.
  3. Given a record the server rejects, When sync returns, Then it is marked `rejected` with the reason, hidden from projections, and listed under "Rejected".
  4. Given a deduction with no photo, When the user tries to save, Then save is blocked with a Hindi message (photo required).
  5. Given a payment of ₹2,500 and `photoRequiredAbovePaise`=200000, When saved without a photo, Then it is blocked; a ₹1,900 payment saves without photo.
  6. Given a 6 MB camera image, When captured, Then it is compressed to ≤1280 px JPEG and stored, and uploaded ≤2 MB.
  7. Given the same record is pushed twice, When sync runs, Then the server accepts it once (idempotent by id).
- **Open questions**: none.

---

### SPEC-003 — Loom & weaver registries (+ minimal thekedar)
- **PRD feature IDs**: B1 / C1 (+ D8 thekedar)
- **Status**: Approved (goal 2026-10-09)
- **Problem**: The unit needs a trusted directory of looms, weavers and thekedars to attach work, wool and payments to.
- **Users**: Owner, munshi (create/edit); thekedar (view own looms).
- **Scope — In**: CRUD-as-versions for `loom`, `weaver`, `thekedar`; routes `/looms`,`/looms/new`,`/looms/:id`,`/weavers`,`/weavers/new`,`/weavers/:id`,`/thekedars`,`/thekedars/new`; photos; projections `listLooms`,`listWeavers`,`listThekedars`. Thekedar is minimal (name, phone, village, looms) + wool balance per thekedar (D8).
- **Scope — Out**: Thekedar tiers/ledger (P1); GPS auto-capture beyond optional lat/lng.
- **Data**: `LoomP`(entityId,code,village,widthIn,thekedarId?,weaverIds[],lat?,lng?,photoId?,active); `WeaverP`(entityId,name,fatherName,village,phone,phoneType∈{smartphone,keypad,shared},upi?,loomId?,photoId?,active); `ThekedarP`(entityId,name,phone,village,photoId?,active).
- **Rules / Formulas**: Edits create a new version (same `entityId`); `active:false` retires without deleting. Thekedar wool balance derived from `yarnBalances(recs)` holder kind='thekedar'. Only owner/munshi may `loom.manage`/`weaver.manage`.
- **UI notes**: Hindi-first lists with photo + name + village; big tap rows; phoneType shown as icon; red/green reserved for money/wool only.
- **Acceptance criteria**:
  1. Given munshi on `/looms/new`, When he saves code+village+widthIn, Then a `loom` record is created and appears in `listLooms`.
  2. Given a weaver edited to a new village, When saved, Then `listWeavers` shows the new value and `/audit` shows old→new.
  3. Given a loom retired (`active:false`), When lists render, Then it is excluded from active pickers but still visible in history.
  4. Given a thekedar with issued wool, When his profile opens, Then wool balance per shade/lot shows from `yarnBalances`.
  5. Given a thekedar user, When he lists looms, Then only looms with his `thekedarId` appear (`visibleLoomIds`).
  6. Given a weaver with phoneType='keypad', When saved, Then slip delivery later defaults to shared/alternate phone handling (no smartphone assumptions).
- **Open questions**: none.

---

### SPEC-004 — Order → pieces, assign to loom, piece status
- **PRD feature IDs**: A1
- **Status**: Approved (goal 2026-10-09)
- **Problem**: An exporter order of N identical carpets must split into trackable pieces, each assignable to a loom/weaver and moving through a defined status lifecycle.
- **Users**: Owner, munshi.
- **Scope — In**: `/orders`,`/orders/new`,`/orders/:id`; create `order` with `count` → auto `pieces[]` (pieceId=`${orderNo}/${seq padded 2}`); `piece_assign` (loom + optional weaver); `piece_status` (delivered/on_hold/resumed); projection `listPieces` with derived status/wovenIn/pctWoven; D5 lifecycle.
- **Scope — Out**: Partial/mixed-size orders; sub-contracting splits.
- **Data**: `OrderP`(entityId,orderNo,exporter,design,quality,colour,lengthIn,widthIn,count,dueDate?,pieces[{pieceId,seq}]); `PieceAssignP`(pieceId,loomId,weaverId?); `PieceStatusP`(pieceId,status∈{delivered,on_hold,resumed},note?).
- **Rules / Formulas**: Status (D5): not_started → on_loom (after assign) → off_loom (after bazaar) → delivered; side state on_hold (resume returns to prior). Demo order EX-118 is **ordered as 12 pieces at 8'0"×10'0"** (orderNo EX-118, lengthIn=96, widthIn=120, count=12, exporter "Sharma Exports", design "Kashan 14"); quality + colour per seed. The **ordered size is the specification**; the **as-woven measured size can differ** — the demo piece **EX-118/03 is measured at bazaar as 8'0"×9'11" (96×119)**, which drives the C3/E2 wage math (area 79.33 sqft; see SPEC-007). `order.create` gated by `can`. (The 8'0"×9'11" figure in older drafts referred to the *measured* piece, not the ordered geometry — they are reconciled here: ordered 96×120, measured 96×119.)
- **UI notes**: Big piece tiles with status colour chips; Hindi status labels; count stepper.
- **Acceptance criteria**:
  1. Given order EX-118 count=12, When created, Then 12 pieces EX-118/01..12 exist with status not_started. (E2E `07-exporter-mock.spec.ts` asserts the seeded order projects count=12, exporter "Sharma Exports", design "Kashan 14".)
  2. Given piece EX-118/03 assigned to a loom, When viewed, Then its status is on_loom and the loom shows the piece.
  3. Given a bazaar recorded for EX-118/03, When `listPieces` runs, Then its status becomes off_loom.
  4. Given a piece set on_hold then resumed, When status computed, Then it returns to its prior lifecycle state, not reset.
  5. Given a piece with no `piece_assign`, When shown, Then status is not_started and it is not on any loom.
  6. Given count=0 entered, When saving, Then validation blocks with a Hindi message (count must be ≥1).
  7. Given a delivered piece, When a late check-in arrives, Then status stays delivered (no backward transition).
- **Open questions**: none.

---

### SPEC-005 — Yarn issue/return + balances + material outside
- **PRD feature IDs**: E1
- **Status**: Approved (goal 2026-10-09)
- **Problem**: Wool given to looms/thekedars must be tracked by shade/lot so balances ("material outside") and tauli are correct.
- **Users**: Owner, munshi.
- **Scope — In**: `/yarn`,`/yarn/issue`,`/yarn/return`; `yarn_issue`/`yarn_return` with `Holder` (loom+optional pieceId, or thekedar) + shade + lot + grams; projections `yarnBalances(recs)` (by holder & shade/lot: grams + oldest issue day), `pieceYarn(recs,pieceId)`→{issuedG,returnedG}. First issue day drives rate lock (D2).
- **Scope — Out**: Dyeing lots, multi-shade blends per issue line.
- **Data**: `YarnIssueP`{holder,shade,lot,grams}; `YarnReturnP`{holder,shade,lot,grams}; `Holder` = {kind:'loom',loomId,pieceId?} | {kind:'thekedar',thekedarId}. Grams integer; display via `gramsToKgStr` (3 dp).
- **Rules / Formulas**: Balance = Σissued − Σreturned per holder+shade+lot. Demo: two issues of 12.000 kg (12000 g each) to piece EX-118/03 → issuedG 24000; returnedG 1100 → used 22900. "Material outside" = positive balances. `pieceYarn` sums only loom-holder records with matching pieceId.
- **UI notes**: Red for issued (given out), green for returned (received back); kg 3 dp big numerals; shade/lot chips.
- **Acceptance criteria**:
  1. Given two 12.000 kg issues to EX-118/03, When `pieceYarn` runs, Then issuedG=24000.
  2. Given a 1.100 kg return for EX-118/03, When computed, Then returnedG=1100 and used=22900.
  3. Given issues/returns across shades, When `yarnBalances` runs, Then balances are grouped by holder+shade+lot with the oldest issue day.
  4. Given a return of 0 g, When saved, Then validation blocks (grams must be >0).
  5. Given a return exceeding issued for that holder+shade+lot, When saved offline, Then local balance may go negative and is flagged for review (no silent clamp).
  6. Given the first issue for a piece on 2026-10-05, When bazaar is later recorded, Then the rate locked is the one effective on 2026-10-05 (D2).
  7. Given a piece with no yarn issue, When bazaar is attempted, Then tauli flags "no wool issued" (see SPEC-007 edge case).
- **Open questions**: none.

---

### SPEC-006 — Rate card (owner-only) + lock + norms
- **PRD feature IDs**: C2
- **Status**: Approved (goal 2026-10-09)
- **Problem**: Weaving rates per quality must be owner-controlled, versioned by effective date, and locked to a piece at first wool issue to prevent disputes.
- **Users**: Owner (edit); munshi/thekedar (view only).
- **Scope — In**: `/rates`; `rate` records (quality, unit sqft|sqgaj, ratePaise, effectiveFrom); `norm` records (quality, gramsPerSqft); projections `rateForPiece(recs,pieceId,onDay)` (D2) and `normFor(recs,quality)`. `rate.edit` owner-only; server rejects non-owner rate records.
- **Scope — Out**: Weaver-specific or loom-specific rates (P1).
- **Data**: `RateP`(entityId,quality,unit∈{sqft,sqgaj},ratePaise,effectiveFrom YYYY-MM-DD); `NormP`(entityId,quality,gramsPerSqft). 1 sq gaj = 9 sq ft.
- **Rules / Formulas**: `rateForPiece` = rate in force on the first yarn-issue day for that piece, else `onDay` if no issue yet (D2). Demo: quality rate ₹38/sqft = 3800 paise/sqft. If unit=sqgaj, convert to per-sqft by /9 for wage. Latest `at` per `effectiveFrom` wins.
- **UI notes**: Owner-only edit button; munshi sees read-only card; big ₹ numerals; effectiveFrom date picker.
- **Acceptance criteria**:
  1. Given owner sets ₹38/sqft effective 2026-10-01, When `rateForPiece` runs for a piece first-issued 2026-10-05, Then ratePaise=3800, unit=sqft.
  2. Given a munshi, When he opens `/rates`, Then edit controls are hidden and a `rate` write he forces is rejected by the server.
  3. Given two rates (₹36 from 10-01, ₹38 from 10-04), When a piece first issued 10-05, Then ₹38 locks even if bazaar is on 10-20.
  4. Given a piece with no yarn issue yet, When `rateForPiece(...,onDay)` runs, Then the rate effective on `onDay` is used.
  5. Given no rate exists for a quality, When bazaar is attempted, Then wage calc is blocked with "rate missing" (see SPEC-007).
  6. Given a sqgaj rate of ₹342/sqgaj, When converted, Then per-sqft equals ₹38 (342/9).
- **Open questions**: none.

---

### SPEC-007 — Bazaar + tauli + deductions with photo
- **PRD feature IDs**: C3 / E2
- **Status**: Approved (goal 2026-10-09)
- **Problem**: When a finished carpet returns, the unit must compute wage, run wool reconciliation (tauli), capture deductions with photo evidence, and net peshgi — all consistent with the demo numbers.
- **Users**: Owner, munshi.
- **Scope — In**: `/bazaar/new`,`/bazaar/:id`; create one `bazaar` per piece; `computeWage`, `computeNet`, `computeTauli` (D1), cause codes + weaver ack + reference norm; deductions each with mandatory photo (D4); split payment cash/upi; `roundToRupee`.
- **Scope — Out**: Partial bazaar / multiple weighments per piece.
- **Data**: `BazaarP`(pieceId,loomId,weaverId,thekedarId?,lengthIn,widthIn,areaSqft,carpetGrams,rateId,ratePaise,rateUnit,grossPaise,deductions[{reason,amountPaise,photoId}],peshgiRecoveredPaise,netPaise,paidPaise,roundingPaise,payment{cashPaise,upiPaise},tauli:TauliResult); `TauliCause`∈{moisture,less_wool_returned,wrong_weighing,other}.
- **Rules / Formulas**: area=(96×119)/144=79.33 sqft. gross=round(79.33×3800)=301454 paise (₹3,014.54). deductions=6000 (₹60); peshgiRecovered=100000 (₹1,000). net=301454−6000−100000=195454 (₹1,954.54). paid=round₹1=195500 (₹1,955), rounding=+46 paise shown on slip (D6). Tauli (D1): issuedG 24000, returnedG 1100, usedG 22900; allowedG=round(22900×3/100)=687; gapG=used−carpet=22900−21600=1300; shortG=max(0,1300−687)=613; extraG=max(0,carpet−used)=0. Reference: normGPerSqft×areaSqft shown but not used for short calc.
- **UI notes**: Red for deductions/short wool, green for net paid; big numerals; cause-code chips; weaver ack toggle; photo thumbnails per deduction.
- **Acceptance criteria**:
  1. Given the demo piece, When bazaar is computed, Then gross=301454, net=195454, paid=195500, rounding=46.
  2. Given tauli inputs 24000/1100/21600 at 3%, When computed, Then usedG=22900, allowedG=687, shortG=613, extraG=0.
  3. Given a deduction without a photo, When saving, Then save is blocked (D4).
  4. Given a second bazaar for the same piece, When pushed, Then the server rejects it and the client marks it `rejected`.
  5. Given carpetGrams > usedG (heavier than wool used), When computed, Then shortG=0 and extraG>0 with a flag (moisture/other cause suggested).
  6. Given a piece with no yarn issue, When bazaar is attempted, Then tauli flags "no wool issued" and short calc is skipped (ack still required).
  7. Given no rate for the quality, When bazaar is attempted, Then wage calc is blocked with "rate missing".
  8. Given a bazaar is reversed, When projections run, Then wage, tauli, peshgi recovery and roker posting all drop out.
- **Open questions**: none.

---

### SPEC-008 — Peshgi give/recover + balance
- **PRD feature IDs**: C5
- **Status**: Approved (goal 2026-10-09)
- **Problem**: Advances (peshgi) to weavers/thekedars must be tracked and recovered from wages without double-counting.
- **Users**: Owner, munshi.
- **Scope — In**: `/peshgi/new`; `peshgi` give records (amount, mode cash/upi, note); recovery captured in bazaar `peshgiRecoveredPaise`; projections `peshgiBalance(recs,personKind,personId)` and `peshgiLedger(...)`. Photo required for give > ₹2,000 (D4).
- **Scope — Out**: Interest, instalment schedules.
- **Data**: `PeshgiP`(personKind∈{weaver,thekedar},personId,amountPaise,mode,note?). Recovery lives on `BazaarP.peshgiRecoveredPaise` (D7).
- **Rules / Formulas**: balance = Σ given − Σ recovered. Demo: give 100000 paise (₹1,000); bazaar recovers 100000 → balance 0. Recovery netted from wage; roker posts net paid only (D7). Recovery cannot exceed current balance.
- **UI notes**: Red for amount given out; green when recovered; big ₹ numerals; mode toggle cash/upi.
- **Acceptance criteria**:
  1. Given a ₹1,000 give to the demo weaver, When `peshgiBalance` runs, Then balance=100000 (red).
  2. Given a bazaar recovering ₹1,000, When computed, Then balance=0 and roker posts only net paid (₹1,955), not gross.
  3. Given a recovery greater than the current balance, When attempted, Then it is blocked/clamped with a Hindi warning (no negative balance).
  4. Given a give of ₹2,500 without a photo, When saving, Then blocked (D4); ₹1,900 saves without photo.
  5. Given a peshgi give is reversed, When `peshgiBalance` runs, Then that amount drops out of the balance.
  6. Given a zero/negative give amount, When saving, Then validation blocks (amount must be >0).
- **Open questions**: none.

---

### SPEC-009 — Slip text + voice via wa.me + public slip page
- **PRD feature IDs**: C8 / C9
- **Status**: Approved (goal 2026-10-09)
- **Problem**: Weavers (often keypad phones, low literacy) need a shareable, verifiable slip they can read, hear in Hindi, and agree/dispute — without logging in.
- **Users**: Owner/munshi (share); weaver (view/respond).
- **Scope — In**: `buildBazaarSlip`,`buildPeshgiSlip`→`SlipP` (minus token); `waMeLink(phone,text)` (India prefix 91); share only via `PreviewShareSheet` (recipient + full text + confirm); `/s/:token` public page (no login) with Hindi TTS + Agree/Dispute; `POST /api/slips/:token/response` → `slip_response` record (role 'weaver'); `GET /api/slips/:token`.
- **Scope — Out**: Native app voice recording; multilingual beyond hi/en. **C9 "voice slip" is delivered per decision D3 as a wa.me text link → public `/s/:token` page that plays the Hindi slip via on-page browser TTS (`speechSynthesis`) — not a pre-generated/shareable audio file.** A server-generated audio clip is out of P0 scope (P1); the `noVoice` fallback covers devices without a Hindi voice.
- **Data**: `SlipP`(token≥22 chars base64url,kind,sourceId,weaverId,weaverName,weaverPhone,textHi,textEn,lines[{label,amountPaise?,value?,sign?}]); `SlipResponseP`(token,slipId,answer∈{agree,dispute},note?). Token = 128-bit random base64url.
- **Rules / Formulas**: Slip lines show gross +, deduction −, peshgi −, rounding, net paid. Demo bazaar slip: gross ₹3,014.54, deduction −₹60, peshgi −₹1,000, net ₹1,954.54, paid ₹1,955 (+₹0.46). `waMeLink` prefixes 91 to 10-digit numbers. Nothing sent silently (PreviewShareSheet). Unknown token → 404; token <22 chars → 404; per-IP rate limit on response.
- **UI notes**: Big Hindi text; prominent Play (TTS) button; Agree (green) / Dispute (red) buttons; reduced-motion respected.
- **Acceptance criteria**:
  1. Given the demo bazaar, When a slip is built, Then lines match ₹3,014.54 / −₹60 / −₹1,000 / net ₹1,954.54 / paid ₹1,955.
  2. Given a weaver phone 98XXXXXXXX, When `waMeLink` runs, Then the link uses 9198XXXXXXXX.
  3. Given a share action, When invoked, Then `PreviewShareSheet` shows recipient + full text and nothing is sent until confirm.
  4. Given a valid token at `/s/:token`, When opened with no login, Then the slip renders and TTS plays Hindi text.
  5. Given a weaver taps Agree, When submitted, Then a `slip_response` (role 'weaver') is stored in the unit stream.
  6. Given a token <22 chars or unknown, When fetched, Then the server returns 404.
  7. Given repeated rapid responses from one IP, When posted, Then rate-limiting applies.
- **Open questions**: none.

---

### SPEC-010 — Check-in photo + length, % woven
- **PRD feature IDs**: B2
- **Status**: Approved (goal 2026-10-09)
- **Problem**: Owners need periodic proof of progress (photo + woven length) to compute % woven and detect idle looms.
- **Users**: Thekedar, munshi, owner.
- **Scope — In**: `/checkin/new`; `checkin` record (pieceId, loomId, wovenIn, optional lat/lng) + photo; `listPieces` derives `wovenIn`, `pctWoven`, `lastCheckinAt`; feeds loom board (SPEC-012).
- **Scope — Out**: Automatic image measurement; GPS geofencing.
- **Data**: `CheckinP`(pieceId,loomId,wovenIn,lat?,lng?). pctWoven = wovenIn / pieceLengthIn (clamp 0..100).
- **Rules / Formulas**: wovenIn uses inches (`ftInToIn`); pctWoven=round(min(100, wovenIn/lengthIn×100)). Demo piece lengthIn=96; a 48" check-in → 50%. Latest check-in per piece wins for `lastCheckinAt`. Photo encouraged; required above threshold is a deduction/payment rule, not check-in (check-in photo optional but recommended).
- **UI notes**: Length entered as ft+in; big % numeral with progress bar; thekedar sees only his looms.
- **Acceptance criteria**:
  1. Given a 48" check-in on the 96" piece, When `listPieces` runs, Then pctWoven=50 and lastCheckinAt updates.
  2. Given a thekedar, When he opens `/checkin/new`, Then only his looms are selectable (`visibleLoomIds`).
  3. Given wovenIn > lengthIn, When computed, Then pctWoven clamps to 100 (no overflow).
  4. Given wovenIn=0 or negative, When saving, Then validation blocks (must be ≥0 and >previous or flagged).
  5. Given two check-ins same day, When computed, Then the latest `at` wins for progress.
  6. Given a check-in offline with a photo, When saved, Then it queues with the photo and later syncs.
- **Open questions**: none.

---

### SPEC-011 — Roker cash/UPI auto-posting
- **PRD feature IDs**: O1
- **Status**: Approved (goal 2026-10-09)
- **Problem**: The owner's daily cash/UPI ledger (roker) must auto-post from bazaar payments and peshgi gives, plus manual entries, and reconcile opening→closing cash.
- **Users**: Owner (view), munshi (manual entries).
- **Scope — In**: `/roker`; `roker` manual entries (dir in/out, mode cash/upi, amount, head, note); projection `rokerDay(recs,day)`→{openingCash,entries[],cashIn,cashOut,upiIn,upiOut,closingCash}; auto-posting of net paid from bazaar and peshgi gives (D7).
- **Scope — Out**: Bank reconciliation, multi-account.
- **Data**: `RokerP`(dir∈{in,out},mode,amountPaise,head∈{kharcha,dyer,transport,wool_purchase,receipt,misc},note?); `SettingP.openingCashPaise`,`openingCashDay`.
- **Rules / Formulas**: closingCash = opening + cashIn − cashOut (cash only; UPI tracked separately). Bazaar posts net paid out as cash/upi per payment split (D7); peshgi give posts out. Demo: openingCash ₹42,500 (4250000 paise); a day of cash-out (bazaar ₹1,955 + peshgi ₹1,000 + other kharcha summing to ₹8,000 out) → closingCash ₹34,500 (3450000). Only net paid posts (not gross) (D7).
- **UI notes**: Red for out, green for in; big opening/closing numerals; head chips; mode toggle.
- **Acceptance criteria**:
  1. Given opening ₹42,500 and the demo day's postings netting ₹8,000 cash out, When `rokerDay` runs, Then closingCash=3450000 (₹34,500).
  2. Given a bazaar paid ₹1,955 split cash/upi, When posted, Then only net paid appears (not gross ₹3,014.54) (D7).
  3. Given a peshgi give of ₹1,000 cash, When posted, Then it is a cash-out entry.
  4. Given a reversed bazaar, When `rokerDay` runs, Then its posting drops out and closing recomputes.
  5. Given a manual entry of 0/negative, When saving, Then validation blocks.
  6. Given a UPI receipt ₹5,000, When posted, Then upiIn increases but cash closing is unchanged.
- **Open questions**: none.

---

### SPEC-012 — Owner home loom board + 8 pm digest share
- **PRD feature IDs**: K2 / K1
- **Status**: Approved (goal 2026-10-09)
- **Problem**: The owner needs an at-a-glance board of loom health and a shareable end-of-day summary.
- **Users**: Owner.
- **Scope — In**: Owner home `/` loom board (`loomBoard(recs,nowISO)`→ per loom {status:on_track|slow|idle|free, daysSinceProgress}); D9 idle thresholds; `/digest` with `digest(recs,day,nowISO)` + PreviewShareSheet to share the 8 pm summary.
- **Scope — Out**: Charts/analytics beyond counts; scheduled auto-send.
- **Data**: Uses projections over all records; `SettingP.idleYellowDays`=4, `idleRedDays`=7 (D9). Digest = counts of pieces by status, wool outside, cash closing, bazaars done, slips sent.
- **Rules / Formulas**: Loom status (D9): on_track if progress < idleYellowDays old; slow (yellow) ≥4 and <7 days since progress; idle (red) ≥7 days; free if no active piece. Demo board source of truth = grid (17 on_track / 3 slow / 3 idle / 1 no-wool→free). Digest at 8 pm reflects the day's roker closing (₹34,500) and bazaar count.
- **UI notes**: Colour chips green/amber/red; big counts; share via PreviewShareSheet (recipient + full text + confirm).
- **Acceptance criteria**:
  1. Given a loom last progressed 5 days ago, When `loomBoard` runs, Then status=slow (yellow), daysSinceProgress=5.
  2. Given a loom last progressed 8 days ago, When computed, Then status=idle (red).
  3. Given a loom with no active piece, When computed, Then status=free.
  4. Given custom thresholds (yellow 3 / red 6), When settings change, Then board recolours accordingly.
  5. Given end of day, When owner opens `/digest`, Then it shows closing ₹34,500, bazaars done, wool outside and piece status counts.
  6. Given a share tap, When invoked, Then PreviewShareSheet shows the full digest text and nothing sends until confirm.
- **Open questions**: none.

---

### SPEC-013 — Static exporter status mock
- **PRD feature IDs**: A2
- **Status**: Approved (goal 2026-10-09)
- **Problem**: Exporters want a read-only order-status view; for P0 this is a static mock (no live auth) that demonstrates the surface.
- **Users**: Exporter (external, read-only).
- **Scope — In**: `/o/:orderId` public read-only page showing order header + per-piece status + % woven, **driven by the real seeded `OrderP` + `listPieces` projection** for the given orderNo (no login, available offline from the demo seed). Also shows: finished / on-loom counts, average % woven, an **estimated dispatch date projected from weaving pace**, the **live loom-board legend** (single source of truth, 17/3/3/1 for the demo), the **latest per-piece check-in photos via `PhotoThumb`** (real photoIds), a **J2 consent note**, and a **"Demo mock" label**. Clearly a mock, but every number is read from real records — nothing hardcoded.
- **Scope — Out**: Real exporter auth, live sync, document downloads (post-P0).
- **Data**: Reads seeded `OrderP` + `listPieces` + `loomBoard` + `checkin` photos for the demo order EX-118 (ordered 12 pieces, 8'0"×10'0", Sharma Exports / Kashan 14); no static snapshot.
- **Rules / Formulas**: Status chips mirror D5 lifecycle; % woven from SPEC-010; legend/counts come from `loomBoard` (same source as SPEC-012 — no 15/5 vs 17/3 mismatch). Est. dispatch = project the slowest in-progress piece to 100% from its check-in pace, pad +10 days for washing/finishing (fallback +30 days when no measurable pace). An unknown orderId resolves to a **friendly not-found that never echoes the raw id back** (no reflected-input).
- **UI notes**: Clean read-only layout; Hindi + English labels; no action buttons; big status chips; "Demo mock" banner.
- **Acceptance criteria**:
  1. Given the demo order, When `/o/EX-118` opens with no login, Then the header (exporter "Sharma Exports", design "Kashan 14", size 8'0"×10'0") and all **12** pieces with status + % woven render from the real projection. (E2E `07-exporter-mock.spec.ts`.)
  2. Given piece EX-118/03 off_loom, When shown, Then its chip reflects off_loom (bazaar done).
  3. Given the mock legend, When rendered, Then counts match the live board source of truth (17/3/3/1), not the old 15/5, and the old hardcoded Obeetee/Ziegler values are absent. (E2E `07-exporter-mock.spec.ts` asserts `legend-on_track`=17 / `slow`=3 / `idle`=3 / `free`=1 and 0 occurrences of "Obeetee Exports"/"Ziegler 1842".)
  4. Given an unknown orderId, When opened, Then a friendly "not found" renders and the raw id does **not** appear anywhere on the page. (E2E `07-exporter-mock.spec.ts` second case.)
- **Open questions**: A2 remains static for P0; live exporter portal is post-P0.

---

## P0-completion batch — "Remaining" items (approved by user 2026-10-09: "continue and finish the remaining task")
Contract details for all five specs: `docs/superpowers/specs/architecture.md` § "P0-completion batch".

### SPEC-014 — One device per login + remote sign-out
- **PRD feature IDs**: N2 (full: "One device per login with remote sign-out")
- **Status**: Approved (user 2026-10-09)
- **Problem**: PagarBook-style login sharing — one munshi login used on several phones — breaks accountability.
- **Users**: owner (signs out phones), munshi / thekedar (bound to one phone).
- **Scope — In**: server-side binding of each user to one device id; owner takeover (owner logging in on a new phone moves the binding, so the owner can never lock himself out); owner "sign out this phone" in Settings; signed-out phone stops syncing and shows a clear Hindi notice; pending records stay on that phone and sync after a valid re-login.
- **Scope — Out**: SMS/OTP re-verification (F-1, later).
- **Data**: server table `devices(unit_id, user_id, device_id, bound_at, last_seen_at, revoked_at, revoked_by)`; token carries `deviceId`.
- **Rules**: munshi/thekedar token request from a different device while another device is bound → 409 `device_bound`; owner → takeover (old device revoked); `/api/sync` and photo APIs with a token whose device is not the active binding → 401 `device_revoked`; only owner may list/sign out devices; multiple users on ONE shared phone is allowed.
- **Acceptance criteria**:
  1. Given munshi logged in on phone A, When he logs in on phone B online, Then B shows "यह लॉगिन दूसरे फ़ोन पर चालू है — मालिक से फ़ोन बदलवाएँ" and no session starts.
  2. Given the owner taps "इस फ़ोन से साइन आउट करें" for the munshi in Settings, When phone B logs in, Then it succeeds and phone A's next sync shows the signed-out notice and logs out (its unsynced records remain).
  3. Given owner logs in on a new phone, Then it works (takeover) and his old phone is signed out.
  4. Given a munshi token, When it calls the device list/sign-out API, Then 403.
  5. Given owner, munshi and thekedar on one shared office phone, Then all three log in and sync normally.

### SPEC-015 — Hindi voice slip as a real audio clip
- **PRD feature IDs**: C9 (full: "short Hindi audio clip, generated automatically and shared on WhatsApp")
- **Status**: Approved (user 2026-10-09)
- **Scope — In**: spoken Hindi script with numbers in words (`speechHi`, e.g. "एक हज़ार नौ सौ पचपन रुपये"); server renders a small WAV clip per slip (`GET /api/slips/:token/audio`); public slip page plays the clip with a big ▶ button (falls back to on-device TTS if the clip is unavailable); munshi can share the clip file to WhatsApp from the bazaar receipt via the phone's share sheet (Web Share with files), with preview-and-confirm (F-3).
- **Scope — Out**: IVR / missed-call (C10, P2); neural voices.
- **Rules**: clip ≤ 60 s, mono 11.025 kHz 16-bit PCM WAV, cached per token; expired slip → 410; same per-IP rate limit as the slip page; TTS engine runs as an isolated optional component (`server/tts/`), never blocks sync; if unavailable → 503 `tts_unavailable`.
- **Acceptance criteria**:
  1. Given the demo bazaar slip, Then `speechHi` contains "उन्यासी दशमलव तैंतीस वर्ग फ़ुट", "तीन हज़ार चौदह रुपये चौवन पैसे" and "एक हज़ार नौ सौ पचपन रुपये".
  2. Given a valid token, When `/api/slips/<token>/audio` is fetched, Then 200 `audio/wav`, valid RIFF header, duration 2–60 s; unknown token 404; expired 410.
  3. Given the public slip page, When ▶ is tapped, Then the clip plays (falls back to device TTS when the clip request fails).
  4. Given the bazaar receipt, When "आवाज़ भेजें" is used on a phone that supports file sharing, Then a preview shows the recipient + clip and the share sheet opens with `slip-<piece>.wav`; unsupported phones see a clear fallback (send the link).

### SPEC-016 — More rate units + other paid work (kg / day / piece)
- **PRD feature IDs**: C2 (full: "per sq ft, gaj, piece, kg or day … ancillary work (untying by kg, thread straightening by kg, day-rate helpers)")
- **Status**: Approved (user 2026-10-09)
- **Scope — In**: weaving rates per sq ft / sq gaj / **piece** (bazaar wage = flat rate per carpet for piece); job rates for **untying (kg), straightening (kg), helper (day), other (piece)** with dated versions, owner-only; munshi "दूसरा काम / job payment" entry (worker, work, qty, auto rate, amount, cash/UPI split, photo above D4 threshold); job payments post to roker, digest and the weaver passbook; server recomputes job amounts.
- **Scope — Out**: completion-bonus rules (later).
- **Data**: `RateP.unit` + `RateP.work`; new record `job` (`JobP`).
- **Rules**: piece wage gross = ratePaise; job amount = round(qty × rate) (kg qty = grams/1000; day qty multiple of 0.5; piece qty integer ≥ 1); paid = half-up rupee; cash + upi = paid; no job without a rate in force.
- **Acceptance criteria**:
  1. Given a piece rate ₹8,000 for "Soumak", When a Soumak carpet's bazaar is recorded, Then gross = ₹8,000 regardless of size.
  2. Given straightening ₹7/kg, When 12.500 kg is paid, Then amount ₹87.50 → paid ₹88 (+₹0.50 rounding), roker shows a cash/UPI out "सीधा करना · <name>".
  3. Given helper ₹350/day, When 1.5 days is paid to a helper not in the registry, Then amount ₹525 and the name is required.
  4. Given no job rate for the work, Then saving is blocked with a link to rates (owner) / "मालिक से रेट डलवाएँ" (munshi).
  5. Given a tampered job amount, Then the server rejects it (`invalid_amounts`).

### SPEC-017 — Full owner home (loom board)
- **PRD feature IDs**: K2 (full)
- **Status**: Approved (user 2026-10-09)
- **Scope — In**: loom status **no wool** (grey, package icon) besides on track / slow / idle / free; filter by thekedar **or order**; "looms free in the next 30 days" (estimate from check-in pace); material outside; dues (total peshgi outstanding); today's entries by staff; orders at risk (from K1).
- **Rules**: no_wool = loom has an on_loom piece and (no wool ever issued to that piece, or estimated remaining wool ≤ 0 using norm × area × remaining fraction); precedence no_wool > idle > slow > on_track. Pace = inches woven ÷ days since assignment; free date = last check-in day + ceil(remaining in ÷ pace); shown as "अनुमान".
- **Acceptance criteria**:
  1. Given the demo, Then the board shows 17 on track / 3 slow / 3 idle / 1 no wool (PRD demo grid) and legend counts match.
  2. Given order filter EX-118, Then only looms with EX-118 pieces show.
  3. Given a piece with pace 2 in/day and 20 in remaining, Then its loom is listed as free in ~10 days.
  4. Given peshgi balances ₹4,000 + ₹2,000, Then dues tile shows ₹6,000.
  5. Given today's records by munshi Ramesh (12) and owner (3), Then "आज की एंट्री" lists both with counts.

### SPEC-018 — Monthly summary
- **PRD feature IDs**: K1 (full: "plus a monthly summary (sq ft woven, wage bill, yarn loss %, rejects)")
- **Status**: Approved (user 2026-10-09)
- **Scope — In**: "इस महीने" card on /digest + share: bazaars, sq ft woven, wage bill (bazaar gross + job amounts), paid, peshgi given/recovered, wool used, wool short, yarn loss % (short ÷ used, 1 dp); month selector (prev/next).
- **Scope — Out**: rejects (needs H4 exporter rejections, P1) — shown as "—" with a note.
- **Acceptance criteria**:
  1. Given the demo month after the live bazaar, Then sq ft includes 79.33, wage bill includes ₹3,014.54, wool short includes 0.613 kg and loss % = short ÷ used.
  2. Given a reversed bazaar, Then it is excluded from the month.
  3. Given the share button, Then the preview text lists every number on its own line in Hindi.

---

### SPEC-019 — Desktop & tablet layout (responsive)
- **PRD feature IDs**: M1 (UI), K2/K1 (owner screens), A2 (exporter page) — layout only, no new data
- **Status**: Approved (user chose option 1A on 2026-10-09: "complete the guide and then start on layout")
- **Problem**: On a laptop the whole app is a 448 px phone column with a bottom bar, wasting the screen; owners in an office and exporters opening their status link use laptops.
- **Users**: owner and munshi on a laptop/tablet; exporter (status page); weaver slip page stays phone-first.
- **Scope — In**:
  - ≥ 1024 px (`lg`): fixed **left side menu** (role-based, same destinations as the bottom bar + the "More" destinations), bottom bar hidden, header full width, content up to 1152 px wide.
  - 768–1023 px (`md`): wider single column (≈ 720 px), bottom bar kept.
  - Owner home in **two columns** (summary, alerts, free-soon, dues, staff | loom board); loom board **8 tiles per row at lg, 12 at xl**.
  - Lists become **tables** at lg: orders, order pieces, looms, weavers (grid ≥ 4 per row or table), thekedars, yarn balances, roker entries, audit log, rates.
  - Forms use a **two-column field grid** at lg; the bazaar wizard shows a **live summary panel** (area, tauli, wage, net, paid) beside the steps.
  - Sheets open as **centered dialogs** at lg (bottom sheets on phones).
  - Public pages: weaver slip centered (≤ 640 px); exporter page wider with a pieces table.
- **Scope — Out**: new features or data; changes below 768 px.
- **Rules**: Tailwind breakpoints only (`md`, `lg`, `xl`); no new npm packages; same tokens/contrast; every existing `data-testid` keeps working on both layouts.
- **Acceptance criteria**:
  1. Given a 1440×900 window, When the owner logs in, Then a side menu is visible, the bottom bar is hidden and the main content is ≥ 900 px wide.
  2. Given the demo data at 1440 px, Then the loom board shows ≥ 8 tiles in its first row and the home page has two columns.
  3. Given ≥ 1024 px, Then orders, roker entries, audit log and yarn balances render as tables with headers.
  4. Given ≥ 1024 px, Then forms lay fields out in two columns and the bazaar wizard shows the live summary panel with the demo numbers (79.33 sq ft → paid ₹1,955).
  5. Given ≥ 1024 px, Then a sheet (e.g. add user, share preview) opens centered, not as a bottom sheet.
  6. Given 1024 / 1280 / 1440 / 1920 px widths, Then no page scrolls horizontally and click targets stay ≥ 44 px.
  7. Given 390 px (phone), Then the layout is unchanged and all existing mobile e2e tests pass.
  8. JS growth ≤ 10 KB gzip; perf budgets still met (cold LCP ≤ 2.5 s, CLS ≤ 0.1).
