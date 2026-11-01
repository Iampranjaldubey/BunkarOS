# Wage examples

Exact inputs and expected values for the wage acceptance tests in `SPECS.md`. Tests (Vitest and Playwright) should use these numbers. Money is in whole paise: ₹1 = 100 paise. The formulas are in SPEC-M02:

- monthly: perDay = round(salary ÷ W); gross = salary − absent × perDay − half × round(perDay ÷ 2)
- daily: gross = (present + paid off days) × rate + half × round(rate ÷ 2)
- net = gross + overtime − deductions − advance recovered
- paid = net rounded to ₹1, half-up; rounding = paid − net

`round` is `Math.round`. All values below were recomputed by script on 2026-11-02.

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

## Notes for the owner (needs confirmation)

These follow the formulas as built and specified. Owners may not expect them:

1. **Absent on a Sunday:** an Absent mark on a Sunday or holiday reduces a monthly worker's pay by one day. In Example B, the 22 Nov mark costs ₹461.54. The rule for daily workers only removes the paid off day.
2. **Joining mid-month:** a monthly worker who joins mid-month gets the full month's salary less marked absences. There is no proration by joining date.

Both are recorded in `docs/decisions.md` under D-002.
