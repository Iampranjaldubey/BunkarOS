// Bunkar OS — sync module public surface.
export {
  syncNow,
  startAutoSync,
  useSyncState,
  getSyncState,
  registerUnitIfNeeded,
  requestToken,
  clearAuthToken,
  bootstrapUsers,
  onDeviceRevoked,
  authedFetch,
} from './client';
export type { TokenResult } from './client';
export type { SyncStateView, SyncResponse } from './types';
