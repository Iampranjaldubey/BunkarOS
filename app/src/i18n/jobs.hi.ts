// Bunkar OS — SPEC-016 job (ancillary work) payment strings (Hindi / Devanagari).
// Merged by i18n/index.ts (auto-globbed *.hi.ts).
const hi = {
  'job.title': 'दूसरा काम / मज़दूरी',
  'job.new.title': 'दूसरे काम की मज़दूरी',
  'job.home.tile': 'दूसरा काम',

  // worker picker
  'job.worker': 'किसको देना है',
  'job.worker.weaver': 'बुनकर',
  'job.worker.thekedar': 'ठेकेदार',
  'job.worker.other': 'कोई और',
  'job.worker.pick': 'नाम चुनें',
  'job.worker.name': 'नाम',
  'job.worker.name.hint': 'जो काम करने वाला रजिस्टर में नहीं है',

  // work type
  'job.work': 'कौन सा काम',

  // quantity
  'job.qty': 'कितना',
  'job.qty.kg': 'वज़न',
  'job.qty.day': 'कितने दिन',
  'job.qty.piece': 'कितने कालीन / पीस',
  'job.day.half': 'आधा दिन (0.5)',

  // rate
  'job.rate': 'रेट',
  'job.rate.locked': 'रेट तय है: {rate}',
  'job.rate.none.owner': 'इस काम का रेट नहीं डला है',
  'job.rate.none.munshi': 'मालिक से रेट डलवाएँ',
  'job.rate.goto': 'रेट डालें',

  // amount + rounding + payment
  'job.amount': 'मज़दूरी',
  'job.rounding': 'राउंडिंग',
  'job.paid': 'दिया',
  'job.payment': 'कैसे दिया',
  'job.cash': 'नकद',
  'job.upi': 'UPI',
  'job.split.mismatch': 'नकद + UPI = दी गई रकम बराबर होनी चाहिए',

  // photo
  'job.photo': 'फ़ोटो',
  'job.photo.required': 'इतनी बड़ी रकम पर फ़ोटो ज़रूरी है',

  // save / confirm / toast
  'job.save': 'मज़दूरी सेव करें',
  'job.confirm.title': 'पक्का सेव करें?',
  'job.confirm.body': '{work} · {worker} — {paid}',
  'job.saved': 'मज़दूरी सेव हो गई',

  // validation
  'job.valid.worker': 'पहले नाम चुनें',
  'job.valid.name': 'नाम ज़रूरी है',
  'job.valid.qty': 'सही मात्रा डालें',
  'job.valid.rate': 'रेट नहीं है',

  // roker / passbook label
  'job.roker.label': '{work} · {worker}',
};
export default hi;
