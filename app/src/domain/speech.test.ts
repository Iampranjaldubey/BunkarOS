import { describe, it, expect } from 'vitest';
import {
  hindiNumber,
  rupeesSpoken,
  decimalSpoken,
  kgSpoken,
  ftInSpoken,
  pieceIdSpoken,
} from './speech.ts';

// A table of at least 30 numbers 0..99 covering the irregular Hindi words,
// plus 100, 101, 1955, 3014, 42500, 100000, 1234567.
const NUM_TABLE: Array<[number, string]> = [
  [0, 'शून्य'],
  [1, 'एक'],
  [2, 'दो'],
  [3, 'तीन'],
  [4, 'चार'],
  [5, 'पाँच'],
  [6, 'छह'],
  [7, 'सात'],
  [8, 'आठ'],
  [9, 'नौ'],
  [10, 'दस'],
  [11, 'ग्यारह'],
  [12, 'बारह'],
  [13, 'तेरह'],
  [14, 'चौदह'],
  [15, 'पंद्रह'],
  [16, 'सोलह'],
  [17, 'सत्रह'],
  [18, 'अठारह'],
  [19, 'उन्नीस'],
  [20, 'बीस'],
  [21, 'इक्कीस'],
  [25, 'पच्चीस'],
  [29, 'उनतीस'],
  [30, 'तीस'],
  [31, 'इकतीस'],
  [40, 'चालीस'],
  [49, 'उनचास'],
  [50, 'पचास'],
  [54, 'चौवन'],
  [55, 'पचपन'],
  [60, 'साठ'],
  [69, 'उनहत्तर'],
  [70, 'सत्तर'],
  [79, 'उन्यासी'],
  [80, 'अस्सी'],
  [89, 'नवासी'],
  [90, 'नब्बे'],
  [99, 'निन्यानवे'],
  [100, 'एक सौ'],
  [101, 'एक सौ एक'],
  [1955, 'एक हज़ार नौ सौ पचपन'],
  [3014, 'तीन हज़ार चौदह'],
  [42500, 'बयालीस हज़ार पाँच सौ'],
  [100000, 'एक लाख'],
  [1234567, 'बारह लाख चौंतीस हज़ार पाँच सौ सड़सठ'],
];

describe('hindiNumber', () => {
  for (const [n, words] of NUM_TABLE) {
    it(`${n} → ${words}`, () => {
      expect(hindiNumber(n)).toBe(words);
    });
  }
});

describe('rupeesSpoken', () => {
  it('3014 rupees 54 paise (demo gross ₹3,014.54)', () => {
    expect(rupeesSpoken(301454)).toBe('तीन हज़ार चौदह रुपये चौवन पैसे');
  });
  it('1955 rupees, no paise part when 0', () => {
    expect(rupeesSpoken(195500)).toBe('एक हज़ार नौ सौ पचपन रुपये');
  });
  it('whole 60 rupees', () => {
    expect(rupeesSpoken(6000)).toBe('साठ रुपये');
  });
  it('single paisa', () => {
    expect(rupeesSpoken(1)).toBe('शून्य रुपये एक पैसा');
  });
});

describe('decimalSpoken', () => {
  it('79.33 → उन्यासी दशमलव तैंतीस', () => {
    expect(decimalSpoken(79.33)).toBe('उन्यासी दशमलव तैंतीस');
  });
  it('whole number has no decimal part', () => {
    expect(decimalSpoken(12)).toBe('बारह');
  });
  it('leading-zero fraction speaks each digit (5.07)', () => {
    expect(decimalSpoken(5.07)).toBe('पाँच दशमलव शून्य सात');
  });
});

describe('kgSpoken', () => {
  it('12000 g → बारह किलो', () => {
    expect(kgSpoken(12000)).toBe('बारह किलो');
  });
  it('22900 g → बाईस दशमलव नौ किलो', () => {
    expect(kgSpoken(22900)).toBe('बाईस दशमलव नौ किलो');
  });
  it('613 g → शून्य दशमलव छह एक तीन किलो', () => {
    expect(kgSpoken(613)).toBe('शून्य दशमलव छह एक तीन किलो');
  });
});

describe('ftInSpoken', () => {
  it('107 inches → आठ फ़ुट ग्यारह इंच', () => {
    expect(ftInSpoken(107)).toBe('आठ फ़ुट ग्यारह इंच');
  });
  it('96 inches → आठ फ़ुट', () => {
    expect(ftInSpoken(96)).toBe('आठ फ़ुट');
  });
  it('11 inches → ग्यारह इंच', () => {
    expect(ftInSpoken(11)).toBe('ग्यारह इंच');
  });
});

describe('pieceIdSpoken', () => {
  it('EX-118/03 → ई एक्स एक सौ अठारह बटा तीन', () => {
    expect(pieceIdSpoken('EX-118/03')).toBe('ई एक्स एक सौ अठारह बटा तीन');
  });
});
