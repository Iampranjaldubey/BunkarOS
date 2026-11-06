import { useSyncState } from '../sync/client';
import { packOf, type IndustryPack } from './index';

/** The pack of the organisation this phone belongs to (carpet until the first sync says otherwise). */
export function usePack(): IndustryPack {
  const { org } = useSyncState();
  return packOf(org?.industry);
}
