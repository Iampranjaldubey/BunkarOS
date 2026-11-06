// SPEC-M18 §8: industry packs. A pack holds what differs between industries; everything else is shared.
// The organisation's industry comes from the platform (sync `org`), so a unit cannot switch its own pack.
import type { JobTitle, ItemUnit, Lang, SizeUnit } from '../db/types';
import bagsWords from './bags/words';

export type IndustryId = 'carpet' | 'bags';
export interface IndustryPack {
  id: IndustryId;
  /** Job titles offered in the worker form, in this order. */
  jobs: JobTitle[];
  /** Units offered for a stock item, in this order. */
  itemUnits: ItemUnit[];
  /** Size unit a new catalogue entry starts with. */
  sizeUnit: SizeUnit;
  /** Raw-material names suggested in the item form (the owner can type anything). */
  materials: Record<Lang, string[]>;
  /** i18n overrides on top of the base (carpet) dictionaries. */
  words: Partial<Record<Lang, Record<string, string>>>;
}

export const PACKS: Record<IndustryId, IndustryPack> = {
  carpet: {
    id: 'carpet',
    jobs: ['weaver', 'finisher', 'helper', 'other'],
    itemUnits: ['kg', 'pcs', 'litre', 'metre'],
    sizeUnit: 'ft',
    materials: {
      hi: ['ऊन', 'सूत', 'जूट', 'रंग', 'लैटेक्स'],
      hin: ['Oon', 'Soot', 'Jute', 'Rang', 'Latex'],
      en: ['Wool', 'Cotton yarn', 'Jute', 'Dye', 'Latex'],
    },
    words: {},
  },
  bags: {
    id: 'bags',
    jobs: ['cutter', 'stitcher', 'finisher', 'packer', 'helper', 'other'],
    itemUnits: ['metre', 'roll', 'pcs', 'kg', 'litre'],
    sizeUnit: 'cm',
    materials: {
      hi: ['कपड़ा (कैनवास)', 'कपड़ा (नायलॉन)', 'रेक्सीन', 'लेदर', 'चेन', 'बकल', 'धागा', 'फ़ोम', 'लाइनिंग'],
      hin: ['Kapda (canvas)', 'Kapda (nylon)', 'Rexine', 'Leather', 'Chain', 'Buckle', 'Dhaaga', 'Foam', 'Lining'],
      en: ['Fabric (canvas)', 'Fabric (nylon)', 'Rexine', 'Leather', 'Zips', 'Buckles', 'Thread', 'Foam', 'Lining'],
    },
    words: bagsWords,
  },
};

export const isIndustryId = (v: unknown): v is IndustryId => v === 'carpet' || v === 'bags';
export const packOf = (industry: string | undefined): IndustryPack => PACKS[isIndustryId(industry) ? industry : 'carpet'];
