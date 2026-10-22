import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/mukta/devanagari-400.css';
import '@fontsource/mukta/latin-400.css';
import '@fontsource/mukta/devanagari-500.css';
import '@fontsource/mukta/latin-500.css';
import '@fontsource/mukta/devanagari-700.css';
import '@fontsource/mukta/latin-700.css';
import '@fontsource/tiro-devanagari-hindi/devanagari-400.css';
import '@fontsource/tiro-devanagari-hindi/latin-400.css';
import './index.css';
try { const th = localStorage.getItem('bunkar.theme'); if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th; } catch { /* ignore */ }
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
