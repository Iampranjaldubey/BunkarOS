// Bunkar OS server — defence-in-depth amount validation (M5).
// Recomputes bazaar money from the raw payload and rejects client-supplied
// numbers that don't match, so a forged/buggy client cannot write arbitrary
// wages into the ledger. Mirrors app/src/domain/{units,wage,money}.ts EXACTLY.

/** Area in sq ft (2 dp) from inches — mirrors units.areaSqft. */
function areaSqft(lengthIn, widthIn) {
  return Math.round(((lengthIn * widthIn) / 144) * 100) / 100;
}

/** Gross paise — mirrors wage.computeWage. piece = flat rate; kg/day invalid for weaving. */
function computeWage(areaSqftVal, ratePaise, rateUnit) {
  if (rateUnit === 'piece') return ratePaise;
  const units = rateUnit === 'sqgaj' ? areaSqftVal / 9 : areaSqftVal;
  return Math.round(units * ratePaise);
}

/** Half-up rupee rounding — mirrors money.roundToRupee. */
function roundToRupee(paise) {
  const rem = ((paise % 100) + 100) % 100;
  let paid;
  if (rem === 0) paid = paise;
  else if (rem >= 50) paid = paise - rem + 100;
  else paid = paise - rem;
  return { paid, rounding: paid - paise };
}

function isInt(n) {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n);
}

function isNonNegInt(n) {
  return isInt(n) && n >= 0;
}

/**
 * Validate a bazaar payload's money. Returns { ok:true } or { ok:false, reason }.
 * reason is always 'invalid_amounts' for defence-in-depth mismatches.
 */
export function validateBazaarAmounts(p) {
  if (!p || typeof p !== 'object') return { ok: false, reason: 'invalid_amounts' };
  const {
    lengthIn, widthIn, areaSqft: areaClaim, rateUnit, ratePaise,
    grossPaise, deductions, peshgiRecoveredPaise, netPaise, paidPaise, roundingPaise, payment,
  } = p;

  // Structural / sign checks.
  if (!isNonNegInt(ratePaise)) return { ok: false, reason: 'invalid_amounts' };
  if (!isNonNegInt(grossPaise)) return { ok: false, reason: 'invalid_amounts' };
  if (!isNonNegInt(peshgiRecoveredPaise)) return { ok: false, reason: 'invalid_amounts' };
  if (!isNonNegInt(netPaise)) return { ok: false, reason: 'invalid_amounts' };
  if (!isNonNegInt(paidPaise)) return { ok: false, reason: 'invalid_amounts' };
  if (!isInt(roundingPaise)) return { ok: false, reason: 'invalid_amounts' };
  if (typeof lengthIn !== 'number' || typeof widthIn !== 'number') return { ok: false, reason: 'invalid_amounts' };
  if (lengthIn < 0 || widthIn < 0) return { ok: false, reason: 'invalid_amounts' };
  if (rateUnit !== 'sqft' && rateUnit !== 'sqgaj' && rateUnit !== 'piece') return { ok: false, reason: 'invalid_amounts' };
  if (!payment || typeof payment !== 'object') return { ok: false, reason: 'invalid_amounts' };
  if (!isNonNegInt(payment.cashPaise) || !isNonNegInt(payment.upiPaise)) {
    return { ok: false, reason: 'invalid_amounts' };
  }
  if (!Array.isArray(deductions)) return { ok: false, reason: 'invalid_amounts' };

  // Deductions: each non-negative integer paise; sum them.
  let dedTotal = 0;
  for (const d of deductions) {
    if (!d || !isNonNegInt(d.amountPaise)) return { ok: false, reason: 'invalid_amounts' };
    dedTotal += d.amountPaise;
  }

  // Area from inches, 2 dp.
  const expectedArea = areaSqft(lengthIn, widthIn);
  if (typeof areaClaim !== 'number' || Math.abs(areaClaim - expectedArea) > 0.001) {
    return { ok: false, reason: 'invalid_amounts' };
  }

  // Gross = round(area * rate) (/9 for sqgaj).
  const expectedGross = computeWage(expectedArea, ratePaise, rateUnit);
  if (grossPaise !== expectedGross) return { ok: false, reason: 'invalid_amounts' };

  // Net = gross - deductions - recovery, must be >= 0.
  const expectedNet = grossPaise - dedTotal - peshgiRecoveredPaise;
  if (expectedNet < 0) return { ok: false, reason: 'invalid_amounts' };
  if (netPaise !== expectedNet) return { ok: false, reason: 'invalid_amounts' };

  // Paid = half-up rupee rounding of net.
  const { paid, rounding } = roundToRupee(expectedNet);
  if (paidPaise !== paid) return { ok: false, reason: 'invalid_amounts' };
  if (roundingPaise !== rounding) return { ok: false, reason: 'invalid_amounts' };

  // cash + upi == paid.
  if (payment.cashPaise + payment.upiPaise !== paidPaise) {
    return { ok: false, reason: 'invalid_amounts' };
  }

  return { ok: true };
}

/**
 * Validate a job (ancillary work) payload's money (SPEC-016). Returns
 * { ok:true } or { ok:false, reason:'invalid_amounts' }.
 * qty must match `unit` (kg → grams integer > 0; day → days multiple of 0.5 > 0;
 * piece → count integer >= 1). amount = round(qty × rate); paid = half-up rupee;
 * rounding = paid - amount; cash + upi = paid; all money non-negative integers.
 */
export function validateJobAmounts(p) {
  if (!p || typeof p !== 'object') return { ok: false, reason: 'invalid_amounts' };
  const { unit, grams, days, count, ratePaise, amountPaise, paidPaise, roundingPaise, payment } = p;

  if (!isNonNegInt(ratePaise)) return { ok: false, reason: 'invalid_amounts' };
  if (!isNonNegInt(amountPaise)) return { ok: false, reason: 'invalid_amounts' };
  if (!isNonNegInt(paidPaise)) return { ok: false, reason: 'invalid_amounts' };
  if (!isInt(roundingPaise)) return { ok: false, reason: 'invalid_amounts' };
  if (!payment || typeof payment !== 'object') return { ok: false, reason: 'invalid_amounts' };
  if (!isNonNegInt(payment.cashPaise) || !isNonNegInt(payment.upiPaise)) {
    return { ok: false, reason: 'invalid_amounts' };
  }

  // Quantity must match the unit.
  let qty;
  if (unit === 'kg') {
    if (!isInt(grams) || grams <= 0) return { ok: false, reason: 'invalid_amounts' };
    qty = grams / 1000;
  } else if (unit === 'day') {
    if (typeof days !== 'number' || !Number.isFinite(days) || days <= 0 || Math.round(days * 2) !== days * 2) {
      return { ok: false, reason: 'invalid_amounts' };
    }
    qty = days;
  } else if (unit === 'piece') {
    if (!isInt(count) || count < 1) return { ok: false, reason: 'invalid_amounts' };
    qty = count;
  } else {
    return { ok: false, reason: 'invalid_amounts' };
  }

  const expectedAmount = Math.round(qty * ratePaise);
  if (amountPaise !== expectedAmount) return { ok: false, reason: 'invalid_amounts' };

  const { paid, rounding } = roundToRupee(expectedAmount);
  if (paidPaise !== paid) return { ok: false, reason: 'invalid_amounts' };
  if (roundingPaise !== rounding) return { ok: false, reason: 'invalid_amounts' };

  if (payment.cashPaise + payment.upiPaise !== paidPaise) {
    return { ok: false, reason: 'invalid_amounts' };
  }

  return { ok: true };
}

/** Reject negative amounts/grams in yarn/peshgi/roker payloads. */
export function validateNonNegative(type, p) {
  if (!p || typeof p !== 'object') return { ok: false, reason: 'invalid_amounts' };
  if (type === 'peshgi' || type === 'roker') {
    if (!isNonNegInt(p.amountPaise)) return { ok: false, reason: 'invalid_amounts' };
  }
  if (type === 'yarn_issue' || type === 'yarn_return') {
    if (!isNonNegInt(p.grams)) return { ok: false, reason: 'invalid_amounts' };
  }
  return { ok: true };
}
