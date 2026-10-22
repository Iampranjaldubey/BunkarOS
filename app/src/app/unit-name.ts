const KEY = 'bunkar.unitName';
export function getUnitName(): string { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } }
export function setUnitName(name: string): void { if (name) { try { localStorage.setItem(KEY, name); } catch { /* ignore */ } } }
