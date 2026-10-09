# Bunkar OS — Agent Instructions

Auto-loaded by Kiro. Read this before doing anything.

## What Bunkar OS is
Hindi-first, phone-first, offline-capable **PWA** for small carpet units in Bhadohi.
Operators are owners/munshis with low-end Android phones and patchy connectivity.
- PRD: `docs/prd/Bunkar_OS_Product_Research.html`
- **P0 = 19 features**: M1, N2, N1, M3, M5, B1, C1, A1, E1, C2, C3, E2, C5, C8, C9, B2, O1, K2, K1

## Stack decision (locked)
React + Vite + TypeScript + Tailwind + shadcn/ui, built as a **PWA**.
Offline via **service worker + IndexedDB** (local-first, sync when online).

## Workflow rules (binding)
a. **Session start**: read `TASKS.md` and the latest `WATCHINGLOGS.md` entries before acting.
b. **New feature**: write/extend the spec in `SPECS.md` first → get user approval → then add tasks to `TASKS.md`.
c. Keep `TASKS.md` status current as work progresses.
d. **Append a `WATCHINGLOGS.md` entry after every meaningful action** — What / Why / Evidence (command output) / Next. Newest at bottom.
e. **Evidence before claims** — never say done/fixed/passing without cited tool output.
f. **Skill routing** per `.kiro/steering/routing.md` — follow it.
g. **Never commit / push / deploy without an explicit user "yes".**

## Steering files
- `.kiro/steering/routing.md` — which skill/agent to use when
- `.kiro/steering/kiro-tools.md` — Claude-Code → Kiro tool translation
- `.kiro/steering/product.md` — Bunkar domain glossary + UI constraints
