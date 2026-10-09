// Bunkar OS — spoken Hindi (Devanagari) number/amount formatting (C9, SPEC-015).
// Pure TS, no React/Dexie. Turns rupees/kg/area/piece ids into a Hindi spoken
// script with numbers in words, using the Indian number system
// (करोड़ / लाख / हज़ार / सौ) with the correct irregular 0–99 words.

// 0–99 Hindi words (irregular — each is its own entry, Hindi has no clean
// tens+units composition rule).
const ONES_0_99: string[] = [
  'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
  'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस',
  'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस',
  'चालीस', 'इकतालीस', 'बयालीस', 'तैंतालीस', 'चौंतालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास',
  'पचास', 'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ',
  'साठ', 'इकसठ', 'बासठ', 'तिरेसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर',
  'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उन्यासी',
  'अस्सी', 'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी',
  'नब्बे', 'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे',
];

// Single digits for digit-by-digit spelling of fractional parts.
const DIGIT_WORD: string[] = ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ'];

/**
 * Hindi words for a non-negative integer in the Indian number system,
 * 0..99,99,99,999 (up to crore+). Groups: करोड़, लाख, हज़ार, सौ, then 0–99.
 */
export function hindiNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  const int = Math.floor(Math.abs(n));
  if (int < 100) return ONES_0_99[int];

  const parts: string[] = [];
  let rest = int;

  const crore = Math.floor(rest / 10_000_000);
  rest %= 10_000_000;
  if (crore > 0) parts.push(`${hindiNumber(crore)} करोड़`);

  const lakh = Math.floor(rest / 100_000);
  rest %= 100_000;
  if (lakh > 0) parts.push(`${ONES_0_99[lakh]} लाख`);

  const thousand = Math.floor(rest / 1000);
  rest %= 1000;
  if (thousand > 0) parts.push(`${ONES_0_99[thousand]} हज़ार`);

  const hundred = Math.floor(rest / 100);
  rest %= 100;
  if (hundred > 0) parts.push(`${ONES_0_99[hundred]} सौ`);

  if (rest > 0) parts.push(ONES_0_99[rest]);

  return parts.join(' ');
}

/** Spell a fractional string ("33", "07", "9") digit-by-digit in Hindi. */
function spellDigits(frac: string): string {
  return frac
    .split('')
    .map((d) => DIGIT_WORD[Number(d)] ?? '')
    .join(' ')
    .trim();
}

/**
 * Rupees spoken from paise: "तीन हज़ार चौदह रुपये चौवन पैसे".
 * The paise part is omitted when it is 0. Uses रुपये (plural) always, and
 * पैसा (1) / पैसे (>1) correctly.
 */
export function rupeesSpoken(paise: number): string {
  const total = Math.round(Math.abs(paise));
  const rupees = Math.floor(total / 100);
  const p = total % 100;
  let out = `${hindiNumber(rupees)} रुपये`;
  if (p > 0) out += ` ${hindiNumber(p)} ${p === 1 ? 'पैसा' : 'पैसे'}`;
  return out;
}

/**
 * A decimal number spoken as "<int> दशमलव <digit digit …>".
 * Whole numbers have no decimal part. The fraction is spelled digit-by-digit
 * (so 79.33 → "उन्यासी दशमलव तैंतीस" reads the pair, 5.07 → "… शून्य सात").
 * `maxFrac` caps the number of fractional digits spoken (default 2).
 */
export function decimalSpoken(value: number, maxFrac = 2): string {
  const neg = value < 0;
  const abs = Math.abs(value);
  const intPart = Math.floor(abs);
  // Round to maxFrac decimals, then trim trailing zeros.
  const scaled = Math.round(abs * 10 ** maxFrac);
  const fracInt = scaled % 10 ** maxFrac;
  let out = hindiNumber(intPart);
  if (fracInt > 0) {
    // Preserve leading zeros to maxFrac width, then drop trailing zeros.
    const frac = String(fracInt).padStart(maxFrac, '0').replace(/0+$/, '');
    if (frac.length === 2 && !frac.startsWith('0')) {
      // Exactly a two-digit fraction with no leading zero → speak as a whole
      // number word (reads naturally: "तैंतीस" for .33 rather than "तीन तीन").
      out += ` दशमलव ${hindiNumber(Number(frac))}`;
    } else {
      out += ` दशमलव ${spellDigits(frac)}`;
    }
  }
  return (neg ? 'ऋण ' : '') + out;
}

/** Grams spoken as kilograms: 12000 → "बारह किलो", 22900 → "बाईस दशमलव नौ किलो". */
export function kgSpoken(grams: number): string {
  const kg = Math.abs(grams) / 1000;
  // kg can have up to 3 decimals (grams precision).
  return `${decimalSpoken(kg, 3)} किलो`;
}

/** Inches spoken as feet + inches: 107 → "आठ फ़ुट ग्यारह इंच"; 96 → "आठ फ़ुट". */
export function ftInSpoken(inches: number): string {
  const total = Math.round(Math.abs(inches));
  const ft = Math.floor(total / 12);
  const inch = total % 12;
  const parts: string[] = [];
  if (ft > 0) parts.push(`${hindiNumber(ft)} फ़ुट`);
  if (inch > 0) parts.push(`${hindiNumber(inch)} इंच`);
  if (parts.length === 0) return 'शून्य इंच';
  return parts.join(' ');
}

// Latin letters → Hindi letter names (for piece ids like "EX").
const LETTER_HI: Record<string, string> = {
  A: 'ए', B: 'बी', C: 'सी', D: 'डी', E: 'ई', F: 'एफ़', G: 'जी', H: 'एच',
  I: 'आई', J: 'जे', K: 'के', L: 'एल', M: 'एम', N: 'एन', O: 'ओ', P: 'पी',
  Q: 'क्यू', R: 'आर', S: 'एस', T: 'टी', U: 'यू', V: 'वी', W: 'डब्ल्यू',
  X: 'एक्स', Y: 'वाई', Z: 'ज़ेड',
};

/**
 * A piece id spoken in Hindi. Letters → letter names, numbers → number words,
 * '/' → "बटा", '-' is a word separator (dropped). E.g.
 * "EX-118/03" → "ई एक्स एक सौ अठारह बटा तीन".
 */
export function pieceIdSpoken(pieceId: string): string {
  const out: string[] = [];
  // Tokenise into runs of letters, digits, and the slash separator.
  const tokens = pieceId.match(/[A-Za-z]+|\d+|\//g) ?? [];
  for (const tok of tokens) {
    if (tok === '/') {
      out.push('बटा');
    } else if (/^\d+$/.test(tok)) {
      out.push(hindiNumber(Number(tok)));
    } else {
      for (const ch of tok.toUpperCase()) {
        out.push(LETTER_HI[ch] ?? ch);
      }
    }
  }
  return out.join(' ');
}
