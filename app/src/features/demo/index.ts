// Bunkar OS — demo feature barrel.
// Re-exports the seed API + the embeddable panel, and (in dev/E2E) installs a
// window hook so the screenshot script and Playwright tests can seed without a
// visible button. Production builds still expose the hook harmlessly; it only
// ever writes to the local IndexedDB of a logged-in owner.
export { loadDemoData, clearUnitData, isDemoLoaded } from './seed';
export { DemoPanel, default as DemoPanelDefault } from './DemoPanel';

import { loadDemoData, clearUnitData } from './seed';

declare global {
  interface Window {
    __bunkarDemo?: {
      load: () => Promise<void>;
      clear: () => Promise<void>;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__bunkarDemo = {
    load: () => loadDemoData(),
    clear: () => clearUnitData(),
  };
}
