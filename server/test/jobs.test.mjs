// Bunkar OS server — SPEC-016 job (ancillary work) + piece-rate bazaar validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, sync, makeRec, bootstrapOwner, getToken, hashPin } from './helpers.mjs';

const KEY = 'secret-key-123';

/** Create a munshi user (authored by owner) and return a token for the munshi. */
async function addMunshi(base, ownerToken, munshiId = 'u-munshi', pin = '1111') {
  const { pinHash, pinSalt } = hashPin(pin);
  const rec = makeRec(
    'user',
    { entityId: munshiId, name: 'Munshi', phone: '9111111111', role: 'munshi', pinHash, pinSalt, active: true },
    { by: 'u-owner', role: 'owner' },
  );
  await sync(base, 'unit-1', KEY, [rec], 0, ownerToken);
  const tok = await getToken(base, 'unit-1', KEY, munshiId, pin);
  return tok.body.token;
}

/** Add a thekedar user (authored by owner) and return its token. */
async function addThekedar(base, ownerToken, id = 'u-thek', pin = '2222') {
  const { pinHash, pinSalt } = hashPin(pin);
  const rec = makeRec(
    'user',
    { entityId: id, name: 'Thek', phone: '9222222222', role: 'thekedar', pinHash, pinSalt, thekedarId: 't-1', active: true },
    { by: 'u-owner', role: 'owner' },
  );
  await sync(base, 'unit-1', KEY, [rec], 0, ownerToken);
  const tok = await getToken(base, 'unit-1', KEY, id, pin);
  return tok.body.token;
}

function job(over = {}, author = 'u-owner') {
  // straightening 12.500 kg @ ₹7/kg = 8750 paise → paid 8800 (+50)
  return makeRec('job', {
    workerKind: 'weaver', workerId: 'w-1', work: 'straightening', unit: 'kg',
    grams: 12500, rateId: 'r-1', ratePaise: 700,
    amountPaise: 8750, paidPaise: 8800, roundingPaise: 50,
    payment: { cashPaise: 8800, upiPaise: 0 },
    ...over,
  }, { by: author });
}

function pieceBazaar(pieceId, ratePaise, over = {}) {
  return makeRec('bazaar', {
    pieceId, loomId: 'l-1', weaverId: 'w-1',
    lengthIn: 96, widthIn: 119, areaSqft: 79.33, carpetGrams: 12000,
    rateId: 'r-p', ratePaise, rateUnit: 'piece',
    grossPaise: ratePaise, deductions: [], peshgiRecoveredPaise: 0,
    netPaise: ratePaise, paidPaise: ratePaise, roundingPaise: 0,
    payment: { cashPaise: ratePaise, upiPaise: 0 },
    tauli: { issuedG: 13000, returnedG: 500, usedG: 12500, wastagePct: 3, allowedG: 375, gapG: 500, shortG: 125, extraG: 0 },
    ...over,
  });
}

test('valid kg job accepted', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const j = job();
  const r = await sync(srv.base, 'unit-1', KEY, [j], 0, token);
  assert.deepEqual(r.body.accepted, [j.id]);
});

test('valid day job to an "other" worker accepted (name required, present)', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  // helper 1.5 days @ ₹350/day = 52500 paise
  const j = job({
    workerKind: 'other', workerId: undefined, workerName: 'Sohan',
    work: 'helper', unit: 'day', grams: undefined, days: 1.5,
    ratePaise: 35000, amountPaise: 52500, paidPaise: 52500, roundingPaise: 0,
    payment: { cashPaise: 52500, upiPaise: 0 },
  });
  const r = await sync(srv.base, 'unit-1', KEY, [j], 0, token);
  assert.deepEqual(r.body.accepted, [j.id]);
});

test('valid piece job accepted', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const j = job({
    work: 'other', unit: 'piece', grams: undefined, count: 3,
    ratePaise: 50000, amountPaise: 150000, paidPaise: 150000, roundingPaise: 0,
    payment: { cashPaise: 150000, upiPaise: 0 },
  });
  const r = await sync(srv.base, 'unit-1', KEY, [j], 0, token);
  assert.deepEqual(r.body.accepted, [j.id]);
});

test('tampered job amount rejected invalid_amounts', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const bad = job();
  bad.payload.amountPaise = 999999;
  bad.payload.paidPaise = 1000000;
  bad.payload.payment = { cashPaise: 1000000, upiPaise: 0 };
  const r = await sync(srv.base, 'unit-1', KEY, [bad], 0, token);
  assert.equal(r.body.accepted.length, 0);
  assert.equal(r.body.rejected[0].reason, 'invalid_amounts');
});

test('job with cash+upi != paid rejected invalid_amounts', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const bad = job({ payment: { cashPaise: 8000, upiPaise: 0 } }); // paid is 8800
  const r = await sync(srv.base, 'unit-1', KEY, [bad], 0, token);
  assert.equal(r.body.rejected[0].reason, 'invalid_amounts');
});

test('munshi may author a job', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const munshiToken = await addMunshi(srv.base, token);
  const j = job({}, 'u-munshi');
  const r = await sync(srv.base, 'unit-1', KEY, [j], 0, munshiToken);
  assert.deepEqual(r.body.accepted, [j.id]);
});

test('thekedar author of a job rejected forbidden_role', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const thekToken = await addThekedar(srv.base, token);
  const j = job({}, 'u-thek');
  const r = await sync(srv.base, 'unit-1', KEY, [j], 0, thekToken);
  assert.equal(r.body.accepted.length, 0);
  assert.equal(r.body.rejected[0].reason, 'forbidden_role');
});

test('job for "other" worker without a name rejected invalid', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const bad = job({
    workerKind: 'other', workerId: undefined, workerName: undefined,
    work: 'helper', unit: 'day', grams: undefined, days: 1.5,
    ratePaise: 35000, amountPaise: 52500, paidPaise: 52500, roundingPaise: 0,
    payment: { cashPaise: 52500, upiPaise: 0 },
  });
  const r = await sync(srv.base, 'unit-1', KEY, [bad], 0, token);
  assert.equal(r.body.accepted.length, 0);
  assert.equal(r.body.rejected[0].reason, 'invalid');
});

test('piece-rate bazaar accepted with gross = rate (AC1)', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const b = pieceBazaar('ORD1/01', 800000); // ₹8,000 flat
  const r = await sync(srv.base, 'unit-1', KEY, [b], 0, token);
  assert.deepEqual(r.body.accepted, [b.id]);
});

test('piece-rate bazaar with gross != rate rejected invalid_amounts', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const b = pieceBazaar('ORD1/02', 800000);
  b.payload.grossPaise = 900000;
  b.payload.netPaise = 900000;
  b.payload.paidPaise = 900000;
  b.payload.payment = { cashPaise: 900000, upiPaise: 0 };
  const r = await sync(srv.base, 'unit-1', KEY, [b], 0, token);
  assert.equal(r.body.rejected[0].reason, 'invalid_amounts');
});

test('kg-rate bazaar rejected invalid_amounts (weaving cannot use kg)', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const b = pieceBazaar('ORD1/03', 800000, { rateUnit: 'kg' });
  const r = await sync(srv.base, 'unit-1', KEY, [b], 0, token);
  assert.equal(r.body.rejected[0].reason, 'invalid_amounts');
});
