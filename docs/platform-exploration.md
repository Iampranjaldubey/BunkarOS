# Multi-industry platform: exploration

Status: **draft for discussion** (2026-11-06). Nothing here is approved or built. Next step: the owner answers §9, then SPEC-M18 is written for approval (AGENTS.md: spec → approval → tasks).

Terms: an **organisation** is what the code calls a **unit** (one business, one tenant). "Unit" stays in the code.

## 1. What the owner decided (2026-11-06)

- Grow from carpet to more industries. One platform brand for every organisation; the name changes later.
- Only the founders create organisations.
- Second industry: **bag making**, with a partner who has no personal ties to the team (Sitare independence rule).
- Bags start with all six modules on: attendance, wages and slips, advances, raw material stock, buyer orders, finished goods catalogue. The partner's feature list decides what turns off.
- Bag pay: a mix, not known yet.
- Founders' admin, for now: create an organisation, set its industry and modules, send the owner's invite. No access to the organisation's data.
- This is part of the Sitare goal, now.

## 2. What exists today

The basic split by organisation is already there:

| Piece | Today | Where |
|---|---|---|
| Tenant | `units` row: id, key hash, name, 6-digit shop code | `server/db.mjs` |
| Data | every entry is a JSON row in `records` with `unit_id`; pulls by `(unit_id, seq)` | `server/db.mjs`, `routes.mjs` |
| Isolation | in application code: every query filters by `unit_id`; tokens are signed per unit; a photo id belongs to the first unit that stores it | `routes.mjs`, SPEC-M16 §6 |
| Organisation admin | the owner role; operator toggles | D-005, `domain/permissions.ts` |
| Per-unit rules | the `setting` record: overtime, off-day policy, slip sections, operator toggles | `domain/settings.ts` |
| Wording | every visible word comes from i18n dictionaries, one file per feature, merged at load | `app/src/i18n/` |
| Founders' admin | `ADMIN_KEYS` login, read-only; admin tokens are refused by every unit endpoint | SPEC-M09 |

Gaps for a platform:

- **Anyone can create an organisation.** `POST /api/units` needs no invite, and `/setup` is public.
- No industry and no module switches per organisation.
- Founders cannot change anything, by design.
- Carpet is written into the code: the finished-item kind, catalogue sizes as length × width, job titles (weaver, finisher), the drawn rugs and knots, and strings like कालीन.
- The server re-reads all records of a type on every sync to check rules (ARCHITECTURE §13). Fine for a few units, slow for many.
- No database-level wall between organisations (no row-level security).

## 3. The market point that shapes this

Generic attendance and salary apps for Indian shops and factories already exist, in Hindi, many free and offline:
- PagarBook ([App Store](https://apps.apple.com/in/app/pagarbook-manage-staff-khata/id1547809321?l=hi))
- StaffBee ([Play](https://play.google.com/store/apps/details?id=com.staffbee.app))
- Hisab Pagar ([Play](https://play.google.com/store/apps/details?id=com.kaambook.app))
- SalaryBox ([Play](https://play.google.com/store/apps/details?id=in.product.salary))

If a multi-industry Bunkar only does attendance and wages, it competes with them on price, and some cost nothing. None of them does the industry's own work:
- raw material in the trade's own units;
- buyer orders with delivery stages;
- a catalogue of the product;
- the trade's pay rules, correct to the paisa, offline.

So the platform should be **one engine plus industry packs that carry real depth**, not one generic app with a different label per industry.

## 4. Proposed model

Three levels:

| Level | Who | Can do | Cannot do |
|---|---|---|---|
| Platform | founders | create an organisation, set its industry, switch modules, send or resend the invite, pause, see usage counts | open the organisation's records (decision 4A) |
| Organisation | owner | everything inside the modules that are on: settings, operators, rates, month lock, wage override | turn on a module the platform turned off |
| People | operators, workers | what the owner allows; the worker's own page | change settings |

Three kinds of switch, kept apart. Product-access rules and business rules change for different reasons, so they live in different places ([entitlements pattern](https://salable.app/blog/saas-startup-guides/entitlements-pattern)):

| Switch | Set by | Example | Stored in |
|---|---|---|---|
| Module | platform | catalogue on / off | `units` row (server-owned) |
| Rule | owner | overtime, off-day policy | `setting` record (as today) |
| Permission | owner | operator may see prices | `setting` record (as today) |

When a module is off:
- it disappears from the side menu, bottom bar, Home tiles and quick entry;
- the server refuses its record types (`module_off`);
- its data stays and comes back when the module is turned on. ERPNext's domain settings do the same: they hide modules but keep the data ([docs](https://docs.frappe.io/erpnext/domain-settings)).

## 5. Architecture options

### 5.1 Tenancy
| Option | Isolation | Cost at our size | Verdict |
|---|---|---|---|
| Shared tables with `unit_id` (today) | application code | lowest | keep |
| + Postgres row-level security (RLS) | database refuses other units' rows even if a query forgets the filter | each request runs in a transaction that sets `app.unit_id`; one policy per table | **add with M18** |
| Schema per organisation | strong | migrations × organisations | no |
| Database per organisation | strongest | cost and operations × organisations | no |

Shared tables with RLS is the common recommendation for pooled SaaS on Postgres ([MakerKit](https://makerkit.dev/blog/tutorials/multi-tenant-saas-architecture), [AWS guidance](https://docs.aws.amazon.com/pdfs/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/saas-multitenant-managed-postgresql.pdf)). I recommend adding it together with the founders' write access, because that access is the first new way to change data across organisations.

### 5.2 Organisation config
- New server-owned columns on `units`: `industry`, `modules` (JSON), `status` (`invited`, `active`, `paused`), `created_by`.
- Not in the owner's `setting` record, because the owner must not be able to switch modules on.
- Sent to phones in every sync response, the way the price view is sent today (SPEC-M13), and kept on the phone for offline use.
- Every founder change goes into an append-only `platform_events` table: who, when, and the value before and after. This follows the existing "nothing is silently changed" rule.

### 5.3 Industry packs (code, one folder per industry)
A pack holds:
- vocabulary: overrides of i18n keys in all three languages, merged after the base dictionaries;
- default modules and default rules;
- job titles, item categories with default units, and product fields. Carpet uses design plus length × width; bags might use model, colour and size;
- product art and the signature detail. Carpet has knots, the border band and drawn rugs; bags are still to be designed;
- demo seed data.

Packs are code, not editable in the console. A pack changes what the wage, stock and catalogue screens accept, so it needs tests, and the brief puts custom fields out of scope. Adding an organisation needs no code; adding an industry is one reviewed pack.

### 5.4 Pay rules per industry
- Pay types stay a list per pack: monthly, daily and per piece today.
- New pay models need new domain code with tests, for example a rate per operation (cutting, stitching, finishing) or job work by outside contractors. Build them only from the bag partner's list.
- The brief already lists contractor and job-work flows as "later ideas, validate first" (§11).

### 5.5 Onboarding by invite only
1. A founder creates the organisation. The server makes the unit and a single-use invite, a code and a link valid for 7 days.
2. The owner opens the link on their phone, enters their name and PIN, and the phone registers.
3. "Create a new unit" on `/setup` then needs an invite. "Join an existing unit" from a second phone works as today.
4. Units that already exist keep working.

### 5.6 Offline and module changes
- A module turned off while a phone is offline: that phone's pending entries for the module are refused on its next sync, with the reason in the entry log. A locked month works the same way today.
- A module turned on appears at the next sync.

### 5.7 Scale
Before about ten busy organisations share a server, keep each unit's running state (balances, locks, paid months) instead of re-reading every record on each sync (ARCHITECTURE §13). The bag pilot doesn't need this yet.

### 5.8 Naming
- The platform name lives in one place: the `app.name` string, the PWA manifest and the page title.
- Internal identifiers stay as they are: `BUNKAR_SECRET`, the `bunkar.*` browser storage keys and the database names. Users never see them.

## 6. Layouts

### 6.1 Founders' console: organisations (desktop, English like today's admin)
```
┌ Platform ───────┬──────────────────────────────────────────────────────────────────────┐
│ ◆ Bunkar        │ Organisations                                 [ + New organisation ]  │
│                 │ [Search]  Industry: All ▾  Status: All ▾                              │
│ Organisations   │ ┌──────────────┬──────────┬──────────┬─────────┬───────────┬─────────┐ │
│ Invites         │ │ Name         │ Industry │ Owner    │ Status  │ Last used │ Entries │ │
│ Industry packs  │ │ Ideal Carpet │ Carpet   │ Ramesh   │ Active  │ today     │ 412     │ │
│ Activity        │ │ Kanpur Bags  │ Bags     │ —        │ Invited │ —         │ 0       │ │
│                 │ └──────────────┴──────────┴──────────┴─────────┴───────────┴─────────┘ │
└─────────────────┴──────────────────────────────────────────────────────────────────────┘
```
"Entries" counts the current month, so the table doubles as usage evidence for the Sitare confirmations.

### 6.2 Organisation detail: modules tab
```
Kanpur Bags · Bags · Invited                              [ Resend invite ] [ Pause ]
Overview | Modules | People | Changes
┌ Attendance ............................................. [■ on ] ┐
│ Daily हाज़िरी, keyboard roll call                                  │
├ Wages and slips ........................................ [■ on ] ┤
├ Advances ............................................... [■ on ] ┤
├ Raw material stock ..................................... [■ on ] ┤
├ Buyer orders ........................................... [■ on ] ┤
├ Finished goods catalogue ............................... [□ off] ┤
│ Off: hidden for 3 users. 42 entries kept, shown again when on.   │
└──────────────────────────────────────────────────── [ Save changes ] ┘
```
Before saving, the panel says what will change: who loses the screen and how many entries are kept. Every save goes to the Changes tab.

### 6.3 New organisation (3 steps)
```
1 Business        2 Modules               3 Invite
Name              Prefilled from the     Owner name + phone
Industry ▾        industry pack;         → link + 6-digit code, 7 days
Language ▾        change any switch      [ Copy ] [ WhatsApp preview → send ]
```

### 6.4 The organisation's own app with a module off
- The side menu, bottom bar, "More" page, quick-entry menu, Home tiles, month report sections and Excel sheets show only modules that are on.
- Settings gets a read-only "Your modules" card: what is on, plus "ask us to turn one on".
- The bottom bar keeps five slots: Home, up to three main modules from the pack, and More.

### 6.5 What changes per industry (bags column = guesses to confirm with the partner)
| | Carpet (today) | Bags (to confirm) |
|---|---|---|
| Product word | कालीन | बैग |
| Job titles | बुनकर, फ़िनिशिंग, हेल्पर | कटिंग, सिलाई, फ़िनिशिंग, पैकिंग, हेल्पर |
| Raw materials | ऊन, सूत, रंग | कपड़ा, रेक्सीन / लेदर, चेन, बकल, धागा, फ़ोम |
| Units | kg, litre, pcs, metre | metre, pcs, roll, kg |
| Product fields | design, length × width, piece tag | model, colour, size, quantity per colour |
| Pay | mostly monthly; daily and per piece | per piece, perhaps per operation; contractors (decision 3D: a mix) |
| Signature detail | knots, border band | a running-stitch line (proposal) |
| Product art without a photo | drawn rug from design and size | drawn bag from model type and colour (proposal) |

The shared design system stays the same: colours, type, spacing, components and motion. Only vocabulary, fields, art and the signature detail change per industry.

## 7. UX features to build

Founders' console:
1. Organisations table with industry, status, owner, last use and this month's entries.
2. New organisation wizard (§6.3).
3. Modules tab that shows the effect before saving (§6.2).
4. Invites: copy, resend, cancel, WhatsApp share with preview (the same pattern as worker links).
5. Pause an organisation (what "paused" means is question 2 in §9).
6. Changes log of every founder action.
7. Industry packs page: read-only view of what each pack contains.

Organisation app:
8. Menus, Home, quick entry, month report and Excel export that follow the modules.
9. "Your modules" card in Settings.
10. A first-run checklist from the pack, e.g. "add 5 workers", "add your raw materials: fabric, zips…".
11. Industry words everywhere, including the printed slip and WhatsApp texts.
12. Entries refused because a module is off show that reason in the entry log.

## 8. Plan

| Step | What | Size | Waits for |
|---|---|---|---|
| M18 Platform base | units columns + `platform_events` + RLS; invite-only creation; modules in sync and in `can()`; server `module_off`; module-aware menus, Home, report and export; pack loader with a carpet pack that reproduces today exactly; founders' console (§7 items 1–7) | large | owner answers to §9 |
| M19 Bags pack v0 | bag vocabulary in 3 languages, job titles, material categories and units, catalogue fields, drawn bag and stitch signature, demo seed | medium | partner's feature list |
| M20 Bag rules | whatever the list needs beyond today's pay types, e.g. per-operation rates or job work, each as its own spec with worked examples like `docs/wage-examples.md` | unknown | the list |
| M21 Scale | per-unit running state instead of re-reading records | medium | ~10 active organisations |

M18 is built so that carpet units see no change. Their e2e suite must pass unchanged, which keeps the Phase 3 carpet contract on track.

Risks:
- **Deadline:** the Sitare goal still needs one carpet unit on a paid recurring contract that is still active 30 days after signing, before 31 March 2027. M18 must not slow that down.
- **Security:** founders' write access is a new path across organisations. RLS, the changes log and no data access contain it.
- **Wage correctness across industries:** no new pay model without tests and worked examples.
- **Independence:** the bag partner must have no personal ties to the team, or it doesn't count for Sitare.
- **Free competitors:** the horizontal apps in §3 are free, so the industry depth is what we sell.

## 9. Questions for the owner

1. **Database-level isolation (RLS)**
   - A. Add with M18, together with the founders' write access **(recommended)**
   - B. Later, before about 10 organisations
2. **A paused organisation**
   - A. Can log in and see everything, can't add entries
   - B. Can't log in
   - C. No pause for now
3. **Opening a new organisation without an invite**
   - A. Invite-only from M18; existing units keep working **(recommended)**
   - B. Leave it open until bags launch
4. **Founders' console language**
   - A. English, as today
   - B. Hindi and English
5. **Bags visual signature**
   - A. Running-stitch line plus a drawn bag **(recommended)**
   - B. Zip teeth
   - C. None; the shared look only
6. **Order of work**
   - A. Build M18 now while the bag list is collected **(recommended)**
   - B. Wait for the list first

## Appendix: questions for the bag partner

To collect the feature list (decision 2). Hindi first; the Hindi is flagged for proofreading.

**काम और लोग / Work and people**
1. कितने कारीगर हैं? कौन-कौन से काम: कटिंग, सिलाई, फ़िनिशिंग, पैकिंग? / How many workers, and which jobs?
2. पगार कैसे देते हैं: महीना, दिहाड़ी, पीस, या हर काम का अलग रेट? / How is each job paid?
3. क्या बाहर के ठेकेदार या जॉब वर्क से काम कराते हैं? माल देकर पीस वापस लेते हैं? / Do you use contractors or job work?
4. एडवांस कैसे कटता है? / How are advances recovered?

**माल / Materials**

5. कौन-सा कच्चा माल रखते हैं, और किस इकाई में: मीटर, रोल, पीस, किलो? / Which raw materials, in which units?
6. एक बैग में कितना माल लगता है, यह गिनते हैं? / Do you track material used per bag?

**बैग और ऑर्डर / Products and orders**

7. बैग की पहचान कैसे करते हैं: मॉडल नंबर, रंग, साइज़? / How do you identify a bag?
8. ऑर्डर कैसे आता है: मॉडल × रंग × गिनती? / What does an order look like?
9. ऑर्डर के चरण क्या हैं: कटिंग, सिलाई, पैकिंग, डिलीवरी? / Which order stages?
10. तैयार बैग का स्टॉक रखते हैं, या सब ऑर्डर पर बनता है? / Stock or made to order?

**बाकी / Other**

11. आज हिसाब कहाँ रखते हैं: रजिस्टर, Excel, कोई ऐप? / Where do you keep accounts today?
12. सबसे ज़्यादा परेशानी किस बात में होती है? / What is the biggest pain?
13. कौन ऐप चलाएगा, किस फ़ोन पर? / Who will use the app, on which phone?
