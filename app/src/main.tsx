import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted fonts (no Google CDN — works fully offline). We import ONLY the
// subsets the Hindi-first UI actually renders — Devanagari + Latin — and skip
// latin-ext/cyrillic/etc. so the PWA precache and first-paint stay small on
// budget Android. Mukta (body) at 400/500/700; Tiro Devanagari (display) at 400.
import '@fontsource/mukta/devanagari-400.css';
import '@fontsource/mukta/latin-400.css';
import '@fontsource/mukta/devanagari-500.css';
import '@fontsource/mukta/latin-500.css';
import '@fontsource/mukta/devanagari-700.css';
import '@fontsource/mukta/latin-700.css';
import '@fontsource/tiro-devanagari-hindi/devanagari-400.css';
import '@fontsource/tiro-devanagari-hindi/latin-400.css';

import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
