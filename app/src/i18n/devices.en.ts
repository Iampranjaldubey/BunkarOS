// Bunkar OS — SPEC-014 device binding + remote sign-out strings (English).
const devicesEn: Record<string, string> = {
  'login.deviceBound': 'This login is active on another phone — ask the owner to switch phones',
  'login.deviceRevoked': 'The owner signed you out of this phone — log in again',

  'devices.title': 'Phones',
  'devices.hint': 'Each login runs on one phone. To let someone switch phones, sign them out here.',
  'devices.offline': 'Phone details appear when you are online.',
  'devices.loading': 'Loading phones…',
  'devices.loadFailed': 'Could not load phones — check the network and try again',
  'devices.retry': 'Try again',
  'devices.empty': 'No one has logged in from a phone yet.',
  'devices.thisPhone': 'This phone',
  'devices.phoneLabel': 'Phone',
  'devices.boundSince': 'Bound since',
  'devices.lastSeen': 'Last seen',
  'devices.lastSeenNever': 'Not yet',
  'devices.signout': 'Sign out this phone',
  'devices.signoutConfirmTitle': 'Sign out this phone?',
  'devices.signoutConfirmMsg': '{name} will be signed out of this phone. Their unsent records stay safe on that phone and sync after a fresh login.',
  'devices.signoutDone': 'Signed out of the phone',
  'devices.signoutFailed': 'Could not sign out — try again',
  'devices.historyShow': 'Show older phones',
  'devices.historyHide': 'Hide older phones',
  'devices.revoked': 'Signed out',
  'devices.unknownUser': 'Unknown user',
};
export default devicesEn;
