import { existsSync } from 'node:fs';
import path from 'node:path';
import { MIN_TEXT_CHARS } from '../constants.js';
import type { VisionOcrHealth } from './visionTypes.js';

const DEFAULT_MAX_PAGES = 20;
const DEFAULT_DPI = 150;
const DEFAULT_TIMEOUT_MS = 60_000;

function readBoolean(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return defaultValue;
}

function readPositiveInt(name: string, defaultValue: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultValue;
}

export function isVisionOcrEnabled(): boolean {
  return readBoolean('VISION_OCR_ENABLED', false);
}

export function getVisionOcrMaxPages(): number {
  return readPositiveInt('VISION_OCR_MAX_PAGES', DEFAULT_MAX_PAGES);
}

export function getVisionOcrMinTextChars(): number {
  return readPositiveInt('VISION_OCR_MIN_TEXT_CHARS', MIN_TEXT_CHARS);
}

export function getVisionOcrDpi(): number {
  return readPositiveInt('VISION_OCR_DPI', DEFAULT_DPI);
}

export function getVisionOcrTimeoutMs(): number {
  return readPositiveInt('VISION_OCR_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
}

/** Resolve GOOGLE_APPLICATION_CREDENTIALS para path absoluto se o arquivo existir. */
export function resolveGoogleCredentialsPath(): string | null {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!raw) return null;

  const candidate = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  if (!existsSync(candidate)) return null;
  return candidate;
}

export function ensureGoogleCredentialsEnv(): string | null {
  const resolved = resolveGoogleCredentialsPath();
  if (resolved) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved;
  }
  return resolved;
}

export function isVisionOcrConfigured(): boolean {
  return isVisionOcrEnabled() && Boolean(resolveGoogleCredentialsPath());
}

export function getVisionOcrHealth(): VisionOcrHealth {
  const enabled = isVisionOcrEnabled();
  if (!enabled) {
    return {
      enabled: false,
      configured: false,
      message: 'VISION_OCR_ENABLED=false',
    };
  }

  const credentialsPath = resolveGoogleCredentialsPath() ?? undefined;
  if (!credentialsPath) {
    return {
      enabled: true,
      configured: false,
      message: 'GOOGLE_APPLICATION_CREDENTIALS ausente ou arquivo inexistente',
    };
  }

  return {
    enabled: true,
    configured: true,
    credentialsPath,
  };
}
