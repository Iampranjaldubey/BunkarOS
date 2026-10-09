const UNIT_NAME_KEY = 'bunkar.unitName';

/** Cached unit name for synchronous header rendering. */
export function getUnitName(): string {
  return localStorage.getItem(UNIT_NAME_KEY) ?? '';
}

export function setUnitName(name: string): void {
  if (name) localStorage.setItem(UNIT_NAME_KEY, name);
}
