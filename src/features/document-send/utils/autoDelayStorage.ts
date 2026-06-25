import {
  AUTO_DELAY_SECONDS_DEFAULT,
  AUTO_DELAY_STORAGE_KEY,
  AUTO_MODE_STORAGE_KEY,
  clampAutoDelaySeconds,
} from '../uploadConstants';

export function loadAutoDelaySeconds(): number {
  try {
    const stored = localStorage.getItem(AUTO_DELAY_STORAGE_KEY);
    if (stored !== null) {
      const parsed = Number.parseInt(stored, 10);
      if (!Number.isNaN(parsed)) {
        return clampAutoDelaySeconds(parsed);
      }
    }
  } catch {
    // ignore storage errors
  }
  return AUTO_DELAY_SECONDS_DEFAULT;
}

export function saveAutoDelaySeconds(seconds: number): void {
  try {
    localStorage.setItem(AUTO_DELAY_STORAGE_KEY, String(clampAutoDelaySeconds(seconds)));
  } catch {
    // ignore storage errors
  }
}

export function loadAutoMode(): boolean {
  try {
    return localStorage.getItem(AUTO_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveAutoMode(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
}
