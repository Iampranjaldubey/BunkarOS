# Wage examples

Exact inputs and expected values for the wage acceptance tests in `SPECS.md`. Tests (Vitest and Playwright) should use these numbers. Money is in whole paise: ₹1 = 100 paise. The formulas are in SPEC-M02:

- monthly: perDay = round(salary ÷ W); gross = salary − absent × perDay − half × round(perDay ÷ 2)
- daily: gross = (present + paid off days) × rate + half × round(rate ÷ 2)
- net = gross + overtime − deductions − advance recovered
- paid = net rounded to ₹1, half-up; rounding = paid − net

`round` is `Math.round`. All values below were recomputed by script on 2026-11-02. The section "Actual results" compares them with what the app computes.

## Example A: monthly worker (SPEC-M02 AC1 and AC5)

**Inputs**

| Input | Value |
|---|---|
| Unit setting `workingDaysPerMonth` (W) | 26 |
| Month | 2026-10 |
| Worker | "Rafiq", pay type monthly, salary ₹12,000 (1,200,000 paise), overtime rate ₹58/h (5,800 paise) |
| Joined | 2026-10-01 |
| Attendance | absent 1 Oct (Thu) and 2 Oct (Fri); half day 3 Oct (Sat); present with 3 h overtime 5 Oct (Mon); every other day unmarked |
| Advance | ₹1,000 (100,000 paise), cash, 1 Oct; nothing recovered before |
| Deduction lines | none |
| Advance recovery | the default (all that is outstanding, capped at what the pay allows) |

**Expected values**

| Value | Paise | Rupees |
|---|---|---|
| perDay = round(1,200,000 ÷ 26) | 46,154 | ₹461.54 |
| Absence deduction = 2 × 46,154 | 92,308 | ₹923.08 |
| Half-day deduction = round(46,154 ÷ 2) | 23,077 | ₹230.77 |
| Gross = 1,200,000 − 92,308 − 23,077 | 1,084,615 | ₹10,846.15 |
| Advance recovered = min(100,000, 1,084,615) | 100,000 | ₹1,000 |

| Case | Overtime | Net | Rounding | **Paid** |
|---|---|---|---|---|
| **AC1**: `overtimeEnabled` on | round(3 × 5,800) = 17,400 | 1,084,615 + 17,400 − 100,000 = 1,002,015 | −15 | **1,002,000 = ₹10,020** |
| **AC5**: `overtimeEnabled` off (the default) | 0 (the 3 h stay recorded but are not paid) | 1,084,615 − 100,000 = 984,615 | −15 | **984,600 = ₹9,846** |

The AC5 payment record is `grossPaise 1084615, otPaise 0, deductions [], advanceRecoveredPaise 100000, netPaise 984615, roundingPaise -15, paidPaise 984600`. The advance balance after payment is ₹0.

AC5 also checks that nothing on the screen mentions overtime with the setting off, and that a new worker gets `otRatePaise` 0.

## Example B: daily worker and the off-day policy (SPEC-M02 AC6 and AC8)

**Inputs**

| Input | Value |
|---|---|
| Month | 2026-11 (30 days). Sundays: 1, 8, 15, 22, 29 |
| Unit holiday list | 2026-11-09 (Monday) |
| Worker | daily rate ₹400 (40,000 paise), overtime 0 |
| Joined | 2026-11-05 |
| Present (18 days) | 5, 6, 7, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26 Nov (none on a Sunday or holiday) |
| Half day (1) | 27 Nov (Fri) |
| Absent (1) | 22 Nov (Sunday) |
| Unmarked | 28 and 30 Nov (working days; they earn nothing) |
| Advances, deductions | none |

Before the joining date: 1 Nov (Sunday) does not count under any policy.

**Expected values**

| `offDayPolicy` | Days the policy chooses (on or after 5 Nov) | Minus absent | Paid off days | Gross = (18 + off days) × 40,000 + 20,000 | **Paid** |
|---|---|---|---|---|---|
| `none` (**AC8**) | — | — | 0 | 740,000 | **₹7,400** |
| `sundays` (**AC8**) | 8, 15, 22, 29 | 22 | 8, 15, 29 = 3 | 860,000 | **₹8,600** |
| `sundays_and_holidays` (default; **AC6**, **AC8**) | 8, 9, 15, 22, 29 | 22 | 8, 9, 15, 29 = 4 | 900,000 | **₹9,000** |

Rounding is 0 in all three cases.

**Same marks, other pay types (AC6)**
- **Piece-rate worker:** off days add nothing under every policy. Example: 120 pieces at ₹15 (1,500 paise) → gross 180,000 = **₹1,800** for `none`, `sundays` and `sundays_and_holidays`.
- **Monthly worker** (₹12,000, W = 26): the policy changes nothing. With these marks (1 absent, 1 half): gross = 1,200,000 − 46,154 − 23,077 = 1,130,769 → paid **₹11,308** (rounding +31) under all three policies.

## Example C: owner override (SPEC-M14 AC1)

**Inputs:** Example A with overtime off (the AC5 worker), plus one override made by the **owner** before confirming the payment:

| Line | Computed | Final | Reason |
|---|---|---|---|
| `absent_deduct` | 92,308 (₹923.08) | 50,000 (₹500) | "एक दिन की छुट्टी दी थी" |

**Expected values**

| Value | Paise | Rupees |
|---|---|---|
| Gross = 1,200,000 − 50,000 − 23,077 | 1,126,923 | ₹11,269.23 |
| Advance recovered | 100,000 | ₹1,000 |
| Net = 1,126,923 − 100,000 | 1,026,923 | ₹10,269.23 |
| Rounding | −23 | −₹0.23 |
| **Paid** | **1,026,900** | **₹10,269** |

**Stored payment record**

```json
{
  "grossPaise": 1126923, "otPaise": 0, "deductions": [], "advanceRecoveredPaise": 100000,
  "netPaise": 1026923, "roundingPaise": -23, "paidPaise": 1026900,
  "overrides": [{ "line": "absent_deduct", "computedPaise": 92308, "finalPaise": 50000, "reason": "एक दिन की छुट्टी दी थी" }]
}
```

**Server checks:**
- 1,126,923 + 0 − 0 − 100,000 = 1,026,923.
- 1,026,923 + (−23) = 1,026,900.
- The worker's salary stays 1,200,000 (AC6).

## Actual results (2026-11-02, branch `desktop-first`)

The actual column comes from the app's wage code (`computeGross` and `settle` in `app/src/domain/wage.ts`, `paidOffDays` in `app/src/domain/attendance.ts`), run on the inputs above. The same values are asserted by `app/src/domain/rules.test.ts` (Vitest). The "Screen" column is what the Playwright tests read on the real pages.

| Example | Inputs | Expected | Actual (wage code) | Screen (Playwright) |
|---|---|---|---|---|
| A, AC1 | Example A, overtime on | net 1,002,015, rounding −15, paid 1,002,000 (₹10,020) | net 1,002,015, rounding −15, paid 1,002,000 | pay page "₹10,020" (e2e 03) |
| A, AC5 | Example A, overtime off | gross 1,084,615, net 984,615, rounding −15, paid 984,600 (₹9,846) | gross 1,084,615, overtime 0, net 984,615, rounding −15, paid 984,600 | pay page "₹9,846", no overtime in counts or lines (e2e 03, e2e 11); new worker `otRatePaise` 0 (e2e 10) |
| B, AC8 `none` | Example B, daily ₹400 | off days none, gross 740,000 (₹7,400) | off days none, present 18, half 1, gross 740,000, paid 740,000 | see note 1 |
| B, AC8 `sundays` | Example B | off days 8, 15, 29, gross 860,000 (₹8,600) | off days 8, 15, 29, gross 860,000, paid 860,000 | see note 1 |
| B, AC6/AC8 `sundays_and_holidays` | Example B | off days 8, 9, 15, 29, gross 900,000 (₹9,000) | off days 8, 9, 15, 29, gross 900,000, paid 900,000 | see note 1 |
| B, AC6 piece | same marks, 120 × ₹15 | ₹1,800 under every policy | 180,000 under all three policies | not run on screen |
| B, AC6 monthly | same marks, ₹12,000 | gross 1,130,769, paid ₹11,308 under every policy | gross 1,130,769, paid 1,130,800 under all three policies | not run on screen |
| C, M14 AC1 | Example A + `absent_deduct` 92,308 → 50,000 | gross 1,126,923, net 1,026,923, rounding −23, paid 1,026,900 (₹10,269) | gross 1,126,923, net 1,026,923, rounding −23, paid 1,026,900; overrides `[{line: absent_deduct, computedPaise: 92308, finalPaise: 50000, reason}]` | pay page "₹10,269"; the stored payment in IndexedDB has the same amounts and override (e2e 11) |

Every actual value equals the expected value.

**Notes**
1. Example B is dated November 2026, which is the current month on the test date, so it cannot be paid from the screen yet. e2e 10 runs the same rule on the previous month's calendar with a ₹400 daily worker. That worker has 3 present weekdays, is absent on the first Sunday, present on the second Sunday and has one unmarked listed holiday. The pay page shows: `none` = 4 days; `sundays` = 3 + (Sundays − 1) days; `sundays_and_holidays` = one day more. The worked Sunday is paid once and the absent Sunday is not paid.
2. **Paid once / Absent removes:** `rules.test.ts` changes Example B to Present on Sunday 8 Nov, Half on holiday 9 Nov and Absent on Sunday 15 Nov. Under the default policy the paid off days are 8, 9 and 29. The Present and Half marks on 8 and 9 Nov are not added again, so gross = (18 + 3) × 40,000 + 20,000 = 860,000. Under `none` the same marks count as ordinary work days (present 19, half 2).
3. **Correction of a paid month (e2e 11):** after Example C is paid and locked, the owner unlocks, reverses the payment and pays again. The second payment overrides `half_deduct` 23,077 → 0: gross 1,107,692, net 1,007,692, paid ₹10,077 (rounding +8). The worker's page then shows only ₹10,077.

## Notes for the owner (needs confirmation)

These follow the formulas as built and specified. Owners may not expect them:

1. **Absent on a Sunday:** an Absent mark on a Sunday or holiday reduces a monthly worker's pay by one day. In Example B, the 22 Nov mark costs ₹461.54. The rule for daily workers only removes the paid off day.
2. **Joining mid-month:** a monthly worker who joins mid-month gets the full month's salary less marked absences. There is no proration by joining date.

Both are recorded in `docs/decisions.md` under D-002.
