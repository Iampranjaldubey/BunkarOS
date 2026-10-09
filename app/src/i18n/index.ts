import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Lang } from '../db/types';
import baseHi from './hi';

type Dict = Record<string, string>;

// --- Hindi (default) is eager; English is lazy -----------------------------
// Hindi is the default language for every low-end phone this app targets, so we
// ship only the Hindi strings in the initial bundle. The English dictionaries
// (base + every feature `*.en.ts`) are code-split into a separate chunk that is
// fetched the first time a user switches to English (or boots already-English).
const featureHi = import.meta.glob<{ default: Dict }>('./*.hi.ts', { eager: true });
// NOT eager — Vite bundles every match into one lazily-imported chunk.
const featureEnLoaders = import.meta.glob<{ default: Dict }>('./*.en.ts');

function mergeFeature(base: Dict, mods: Record<string, { default: Dict }>): Dict {
  const out: Dict = { ...base };
  for (const mod of Object.values(mods)) Object.assign(out, mod.default);
  return out;
}

const HI_DICT: Dict = mergeFeature(baseHi as Dict, featureHi);

// Populated on first demand; until then English falls back to Hindi (so a user
// who boots in English never sees raw keys — they briefly see Hindi, then the
// English chunk resolves and components re-render).
let EN_DICT: Dict | null = null;
let enPromise: Promise<Dict> | null = null;

async function loadEnglish(): Promise<Dict> {
  if (EN_DICT) return EN_DICT;
  if (!enPromise) {
    enPromise = (async () => {
      const [{ default: baseEn }, ...mods] = await Promise.all([
        import('./en'),
        ...Object.values(featureEnLoaders).map((load) => load()),
      ]);
      const modMap: Record<string, { default: Dict }> = {};
      mods.forEach((m, i) => { modMap[String(i)] = m; });
      EN_DICT = mergeFeature(baseEn as Dict, modMap);
      return EN_DICT;
    })();
  }
  return enPromise;
}

function dictFor(lang: Lang): Dict {
  // English dict may not be loaded yet → fall back to Hindi (never raw keys).
  return lang === 'en' ? (EN_DICT ?? HI_DICT) : HI_DICT;
}

const LANG_KEY = 'bunkar.lang';

export function getLang(): Lang {
  const stored = localStorage.getItem(LANG_KEY);
  return stored === 'en' ? 'en' : 'hi';
}

/** Fill {name} placeholders. */
function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

/** Translate a key for a specific language (non-React callers). */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const dict = dictFor(lang);
  const raw = dict[key] ?? HI_DICT[key] ?? key;
  return interpolate(raw, vars);
}

/** Module-level translate using the persisted language (for non-component code). */
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
  // Bumped once the English chunk resolves so consumers re-render with real
  // English strings instead of the Hindi fallback.
  const [enReady, setEnReady] = useState<boolean>(() => getLang() !== 'en');

  // If we boot already in English, fetch the English chunk before showing the
  // tree so an English user never sees a Hindi-fallback flash.
  useEffect(() => {
    if (lang === 'en' && !EN_DICT) {
      void loadEnglish().then(() => setEnReady(true));
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LANG_KEY, l);
    document.documentElement.lang = l;
    if (l === 'en' && !EN_DICT) {
      // Resolve the chunk, THEN flip — avoids any Hindi-fallback flash.
      void loadEnglish().then(() => { setEnReady(true); setLangState('en'); });
    } else {
      setLangState(l);
    }
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, setLang],
  );

  // On an English cold boot, hold the tree back one microtask-chunk-load so the
  // first paint is already in English (no visible Hindi flash).
  if (!enReady) return null;

  return createElement(LangContext.Provider, { value }, children);
}

/** Reactive translation hook — re-renders on language change. */
export function useT(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider (tests, etc.).
    const lang = getLang();
    return {
      lang,
      setLang: () => {},
      t: (key, vars) => translate(lang, key, vars),
    };
  }
  return ctx;
}

/** Imperative language setter (persists; a reload or provider re-render applies). */
export function setLang(l: Lang): void {
  localStorage.setItem(LANG_KEY, l);
  document.documentElement.lang = l;
  if (l === 'en') void loadEnglish();
}
