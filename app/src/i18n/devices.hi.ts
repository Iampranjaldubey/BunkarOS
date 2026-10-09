// Bunkar OS — SPEC-014 device binding + remote sign-out strings (Hindi, default).
const devicesHi: Record<string, string> = {
  // Login notices
  'login.deviceBound': 'यह लॉगिन दूसरे फ़ोन पर चालू है — मालिक से फ़ोन बदलवाएँ',
  'login.deviceRevoked': 'मालिक ने इस फ़ोन से आपको साइन आउट किया है — दोबारा लॉगिन करें',

  // Settings → फ़ोन (owner only)
  'devices.title': 'फ़ोन',
  'devices.hint': 'हर लॉगिन एक ही फ़ोन से चलता है। किसी का फ़ोन बदलना हो तो उसे यहाँ से साइन आउट करें।',
  'devices.offline': 'फ़ोन की जानकारी ऑनलाइन होने पर दिखेगी।',
  'devices.loading': 'फ़ोन लाए जा रहे हैं…',
  'devices.loadFailed': 'फ़ोन की जानकारी नहीं आ पाई — नेटवर्क देखकर दोबारा कोशिश करें',
  'devices.retry': 'दोबारा कोशिश करें',
  'devices.empty': 'अभी किसी फ़ोन से लॉगिन नहीं हुआ।',
  'devices.thisPhone': 'यही फ़ोन',
  'devices.phoneLabel': 'फ़ोन',
  'devices.boundSince': 'जब से जुड़ा',
  'devices.lastSeen': 'आख़िरी बार',
  'devices.lastSeenNever': 'अभी तक नहीं',
  'devices.signout': 'इस फ़ोन से साइन आउट करें',
  'devices.signoutConfirmTitle': 'फ़ोन से साइन आउट करें?',
  'devices.signoutConfirmMsg': '{name} इस फ़ोन से साइन आउट हो जाएगा। उसके बिना भेजे हुए रिकॉर्ड उसी फ़ोन पर सुरक्षित रहेंगे और दोबारा लॉगिन पर भेज दिए जाएँगे।',
  'devices.signoutDone': 'फ़ोन से साइन आउट कर दिया',
  'devices.signoutFailed': 'साइन आउट नहीं हो पाया — दोबारा कोशिश करें',
  'devices.historyShow': 'पुराने फ़ोन दिखाएँ',
  'devices.historyHide': 'पुराने फ़ोन छिपाएँ',
  'devices.revoked': 'साइन आउट किया गया',
  'devices.unknownUser': 'अनजान उपयोगकर्ता',
};
export default devicesHi;
