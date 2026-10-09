import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, createUnit, sync, makeRec, bootstrapOwner, getToken, hashPin } from './helpers.mjs';

const KEY = 'secret-key-123';

function bazaar(pieceId, over = {}) {
  return makeRec('bazaar', {
    pieceId, loomId: 'l-1', weaverId: 'w-1',
    lengthIn: 96, widthIn: 72, areaSqft: 48, carpetGrams: 12000,
    rateId: 'r-1', ratePaise: 15000, rateUnit: 'sqft',
    grossPaise: 720000, deductions: [], peshgiRecoveredPaise: 0,
    netPaise: 720000, paidPaise: 720000, roundingPaise: 0,
    payment: { cashPaise: 720000, upiPaise: 0 },
    tauli: { issuedG: 13000, returnedG: 500, usedG: 12500, wastagePct: 3, allowedG: 375, gapG: 500, shortG: 125, extraG: 0 },
  }, over);
}

/** Create a munshi user (authored by owner) and return a token for the munshi. */
async function addMunshi(base, ownerToken, munshiId = 'u-munshi', pin = '1111') {
  const { pinHash, pinSalt } = hashPin(pin);
  const rec = makeRec(
    'user',
    { entityId: munshiId, name: 'Munshi', phone: '9111111111', role: 'munshi', pinHash, pinSalt, active: true },
    { by: 'u-owner', role: 'owner' },
  );
  const r = await sync(base, 'unit-1', KEY, [rec], 0, ownerToken);
  assert.deepEqual(r.body.accepted, [rec.id], 'owner can create a munshi user');
  const tok = await getToken(base, 'unit-1', KEY, munshiId, pin);
  return tok.body.token;
}

test('duplicate bazaar rejected', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);

  const b1 = bazaar('ORD1/01');
  const r1 = await sync(srv.base, 'unit-1', KEY, [b1], 0, token);
  assert.deepEqual(r1.body.accepted, [b1.id]);

  const b2 = bazaar('ORD1/01');
  const r2 = await sync(srv.base, 'unit-1', KEY, [b2], 0, token);
  assert.equal(r2.body.accepted.length, 0);
  assert.equal(r2.body.rejected[0].reason, 'duplicate_bazaar');
});

test('duplicate bazaar within one batch rejected', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);

  const a = bazaar('ORD1/02');
  const b = bazaar('ORD1/02');
  const r = await sync(srv.base, 'unit-1', KEY, [a, b], 0, token);
  assert.deepEqual(r.body.accepted, [a.id]);
  assert.equal(r.body.rejected[0].id, b.id);
  assert.equal(r.body.rejected[0].reason, 'duplicate_bazaar');
});

test('reversal then re-bazaar allowed', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);

  const b1 = bazaar('ORD1/03');
  await sync(srv.base, 'unit-1', KEY, [b1], 0, token);

  const rev = makeRec('reversal', { targetId: b1.id, reason: 'wrong rate' });
  const rr = await sync(srv.base, 'unit-1', KEY, [rev], 0, token);
  assert.deepEqual(rr.body.accepted, [rev.id]);

  const b2 = bazaar('ORD1/03');
  const r2 = await sync(srv.base, 'unit-1', KEY, [b2], 0, token);
  assert.deepEqual(r2.body.accepted, [b2.id], 'new bazaar accepted after reversal');
});

test('reversal of unknown target rejected invalid', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const rev = makeRec('reversal', { targetId: 'does-not-exist', reason: 'x' });
  const r = await sync(srv.base, 'unit-1', KEY, [rev], 0, token);
  assert.equal(r.body.rejected[0].reason, 'invalid');
});

test('munshi rate record rejected forbidden_role (server-derived role)', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const munshiToken = await addMunshi(srv.base, token);

  // Munshi authors a rate record (even if the client lies about role:'owner'),
  // the SERVER resolves the author's real role → forbidden_role.
  const rate = makeRec(
    'rate',
    { entityId: 'rt-1', quality: '5/40', unit: 'sqft', ratePaise: 15000, effectiveFrom: '2026-10-01' },
    { by: 'u-munshi', role: 'owner' }, // forged client role is IGNORED
  );
  const r = await sync(srv.base, 'unit-1', KEY, [rate], 0, munshiToken);
  assert.equal(r.body.accepted.length, 0);
  assert.equal(r.body.rejected[0].reason, 'forbidden_role');
});

test('owner rate record accepted', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const rate = makeRec('rate', { entityId: 'rt-2', quality: '5/40', unit: 'sqft', ratePaise: 16000, effectiveFrom: '2026-10-02' }, { by: 'u-owner', role: 'owner' });
  const r = await sync(srv.base, 'unit-1', KEY, [rate], 0, token);
  assert.deepEqual(r.body.accepted, [rate.id]);
});

test('C1: munshi cannot self-promote by forging a user record role:owner', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const munshiToken = await addMunshi(srv.base, token);

  // Munshi authors a `user` record making himself an owner.
  const { pinHash, pinSalt } = hashPin('1111');
  const selfPromote = makeRec(
    'user',
    { entityId: 'u-munshi', name: 'Munshi', phone: '9111111111', role: 'owner', pinHash, pinSalt, active: true },
    { by: 'u-munshi', role: 'owner' },
  );
  const r = await sync(srv.base, 'unit-1', KEY, [selfPromote], 0, munshiToken);
  assert.equal(r.body.accepted.length, 0);
  assert.equal(r.body.rejected[0].reason, 'forbidden_role');
});

test('author_mismatch: record authored by someone other than the token user', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);

  // Owner token, but the record claims a different author.
  const loom = makeRec('loom', { entityId: 'l-am', code: 'AM', village: 'X', widthIn: 72, weaverIds: [], active: true }, { by: 'someone-else' });
  const r = await sync(srv.base, 'unit-1', KEY, [loom], 0, token);
  assert.equal(r.body.accepted.length, 0);
  assert.equal(r.body.rejected[0].reason, 'author_mismatch');
});

test('M5: bazaar with tampered amounts rejected invalid_amounts', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);

  // Forge a much larger paid amount than the recomputed math allows.
  const bad = bazaar('ORD1/09', {});
  bad.payload.netPaise = 9_999_900;
  bad.payload.paidPaise = 9_999_900;
  bad.payload.payment = { cashPaise: 9_999_900, upiPaise: 0 };
  const r = await sync(srv.base, 'unit-1', KEY, [bad], 0, token);
  assert.equal(r.body.accepted.length, 0);
  assert.equal(r.body.rejected[0].reason, 'invalid_amounts');
});

test('M5: negative peshgi amount rejected invalid_amounts', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const peshgi = makeRec('peshgi', { personKind: 'weaver', personId: 'w-1', amountPaise: -5000, mode: 'cash' }, { by: 'u-owner' });
  const r = await sync(srv.base, 'unit-1', KEY, [peshgi], 0, token);
  assert.equal(r.body.rejected[0].reason, 'invalid_amounts');
});

test('M5: negative yarn grams rejected invalid_amounts', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const yarn = makeRec('yarn_issue', { holder: { kind: 'loom', loomId: 'l-1' }, shade: 'Red', lot: 'L1', grams: -100 }, { by: 'u-owner' });
  const r = await sync(srv.base, 'unit-1', KEY, [yarn], 0, token);
  assert.equal(r.body.rejected[0].reason, 'invalid_amounts');
});

test('bootstrap: first owner user + setting accepted with unit key only (no token)', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await createUnit(srv.base, 'unit-boot', KEY);
  const { pinHash, pinSalt } = hashPin('1234');
  const owner = makeRec('user', { entityId: 'o1', name: 'Owner', phone: '9', role: 'owner', pinHash, pinSalt, active: true }, { unitId: 'unit-boot', by: 'o1', role: 'owner' });
  const setting = makeRec('setting', { entityId: 'unit', unitName: 'Boot', ownerPhone: '9', lang: 'hi', photoRequiredAbovePaise: 200000, wastagePct: 3, idleYellowDays: 4, idleRedDays: 7, openingCashPaise: 0, openingCashDay: '2026-10-09' }, { unitId: 'unit-boot', by: 'o1', role: 'owner' });
  const r = await sync(srv.base, 'unit-boot', KEY, [owner, setting], 0);
  assert.deepEqual(r.body.accepted.sort(), [owner.id, setting.id].sort());
});
