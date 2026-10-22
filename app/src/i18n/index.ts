import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from '../db/types';
import baseHi from './hi';

type Dict = Record<string, string>;

// Hindi (default) ships in the main bundle; Hinglish and English are lazy chunks.
// Feature dictionaries: src/i18n/<feature>.{hi,hin,en}.ts — merged automatically.
const featureHi = import.meta.glob<{ default: Dict }>('./*.hi.ts', { eager: true });
const featureHinLoaders = import.meta.glob<{ default: Dict }>('./*.hin.ts');
const featureEnLoaders = import.meta.glob<{ default: Dict }>('./*.en.ts');

function merge(base: Dict, mods: Record<string, { default: Dict }>): Dict {
  const out: Dict = { ...base };
  for (const mod of Object.values(mods)) Object.assign(out, mod.default);
  return out;
}

const DICTS: Partial<Record<Lang, Dict>> = { hi: merge(baseHi as Dict, featureHi) };
const loading: Partial<Record<Lang, Promise<Dict>>> = {};

async function loadLang(lang: Lang): Promise<Dict> {
  const have = DICTS[lang];
  if (have) return have;
  if (!loading[lang]) {
    loading[lang] = (async () => {
      const loaders = lang === 'en' ? featureEnLoaders : featureHinLoaders;
      const [{ default: base }, ...mods] = await Promise.all([
        lang === 'en' ? import('./en') : import('./hin'),
        ...Object.values(loaders).map((load) => load()),
      ]);
      const modMap: Record<string, { default: Dict }> = {};
      mods.forEach((m, i) => { modMap[String(i)] = m; });
      const dict = merge(base as Dict, modMap);
      DICTS[lang] = dict;
      return dict;
    })();
  }
  return loading[lang]!;
}

function dictFor(lang: Lang): Dict { return DICTS[lang] ?? DICTS.hi!; }

const LANG_KEY = 'bunkar.lang';
export const LANGS: Lang[] = ['hi', 'hin', 'en'];
export const LANG_LABEL: Record<Lang, string> = { hi: 'हिंदी', hin: 'Hinglish', en: 'EN' };

export function getLang(): Lang {
  try {
    const s = localStorage.getItem(LANG_KEY);
    return s === 'en' || s === 'hin' ? s : 'hi';
  } catch { return 'hi'; }
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const raw = dictFor(lang)[key] ?? DICTS.hi![key] ?? key;
  return interpolate(raw, vars);
}
/** Module-level translate for non-component code. */
export function t(key: string, vars?: Record<string, string | number>): string {
  return translate(getLang(), key, vars);
}

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}
const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => getLang());
  const [ready, setReady] = useState<boolean>(() => Boolean(DICTS[getLang()]));

  useEffect(() => {
    if (!DICTS[lang]) void loadLang(lang).then(() => setReady(true));
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem(LANG_KEY, l); } catch { /* private mode */ }
    document.documentElement.lang = l === 'hin' ? 'hi-Latn' : l;
    if (!DICTS[l]) void loadLang(l).then(() => { setReady(true); setLangState(l); });
    else setLangState(l);
  }, []);

  const value = useMemo<LangContextValue>(() => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }), [lang, setLang]);
  if (!ready) return null;
  return createElement(LangContext.Provider, { value }, children);
}

export function useT(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    const lang = getLang();
    return { lang, setLang: () => {}, t: (key, vars) => translate(lang, key, vars) };
  }
  return ctx;
}

export function setLang(l: Lang): void {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  document.documentElement.lang = l === 'hin' ? 'hi-Latn' : l;
  void loadLang(l);
}
