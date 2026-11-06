// SPEC-M18 §4: open a unit the founders created, with its invite link or code.
import type { Lang, SettingP, UserP } from '../db/types';
import { setMeta } from '../db/db';
import { addRecord } from '../db/repo';
import { uuid } from '../domain/ids';
import { hashPin, generateUnitKey } from '../lib/pin';
import { getLang } from '../i18n';
import { setUnitName } from './unit-name';
import { applyOrg } from '../sync/client';
import type { OrgInfo } from '../sync/types';
import { DEFAULT_SETTINGS, storePinVerifier, type UnitMeta } from './session';

export interface InviteInfo { unitName: string; ownerName: string; ownerPhone: string; lang: Lang; industry: string; expiresAt: string }
export type InviteError = 'not_found' | 'used' | 'expired' | 'revoked' | 'offline' | 'error';
const inviteError = (status: number, error: string | undefined): InviteError =>
  status === 404 ? 'not_found' : error === 'invite_expired' ? 'expired' : error === 'invite_revoked' ? 'revoked' : status === 410 ? 'used' : 'error';
/** Look an invite up by its link token or its typed code. */
export async function lookupInvite(ref: { token?: string; code?: string }): Promise<{ ok: true; info: InviteInfo } | { ok: false; error: InviteError }> {
  try {
    const r = await fetch('/api/invites/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ref) });
    const b = (await r.json()) as InviteInfo & { error?: string };
    return r.ok ? { ok: true, info: b } : { ok: false, error: inviteError(r.status, b.error) };
  } catch { return { ok: false, error: 'offline' }; }
}
/**
 * Claim the invite with a fresh unit key, then write the owner and the first setting on this phone (they sync next),
 * exactly like creating a unit did before SPEC-M18.
 */
export async function claimInviteAndSetup(ref: { token?: string; code?: string }, pin: string): Promise<{ ok: true } | { ok: false; error: InviteError }> {
  const unitKey = generateUnitKey();
  let b: { unitId: string; name: string; ownerName: string; ownerPhone: string; lang: Lang; org: OrgInfo; error?: string };
  try {
    const r = await fetch('/api/invites/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ref, unitKey }) });
    b = await r.json();
    if (!r.ok) return { ok: false, error: inviteError(r.status, b.error) };
  } catch { return { ok: false, error: 'offline' }; }
  const userId = uuid();
  await setMeta('bunkar.unit', { unitId: b.unitId, unitKey, unitName: b.name } satisfies UnitMeta);
  setUnitName(b.name);
  await applyOrg(b.org);
  const { pinHash, pinSalt } = await hashPin(pin);
  const author = { by: userId, role: 'owner' as const, unitId: b.unitId };
  await addRecord<SettingP>('setting', { ...DEFAULT_SETTINGS, unitName: b.name, ownerPhone: b.ownerPhone, lang: b.lang ?? getLang() }, { as: author });
  await addRecord<UserP>('user', { entityId: userId, name: b.ownerName, phone: b.ownerPhone, role: 'owner', pinHash, pinSalt, active: true }, { as: author });
  await storePinVerifier(userId, pin);
  return { ok: true };
}
