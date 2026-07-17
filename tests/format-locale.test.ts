import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import i18n from '../src/i18n/index.ts';
import { DEFAULT_LOCALE } from '../src/i18n/config.ts';
import {
  getActiveLocale,
  formatDate,
  formatDateTime,
  formatTime,
  formatNumber,
  localeCompareActive,
} from '../src/lib/formatLocale.ts';

const FIXED_UTC = new Date(Date.UTC(2026, 0, 15, 9, 5, 3));

describe('formatLocale', () => {
  it('formatDate is byte-identical to native toLocaleDateString for pt-BR with explicit opts', () => {
    const opts = {
      day: '2-digit' as const,
      month: '2-digit' as const,
      year: 'numeric' as const,
      timeZone: 'UTC',
    };
    assert.equal(formatDate(FIXED_UTC, opts, 'pt-BR'), FIXED_UTC.toLocaleDateString('pt-BR', opts));
  });

  it('formatDate without opts is byte-identical to native toLocaleDateString (no-options default path)', () => {
    assert.equal(formatDate(FIXED_UTC, undefined, 'pt-BR'), FIXED_UTC.toLocaleDateString('pt-BR'));
  });

  it('formatDateTime without opts is byte-identical to native toLocaleString for pt-BR', () => {
    assert.equal(formatDateTime(FIXED_UTC, undefined, 'pt-BR'), FIXED_UTC.toLocaleString('pt-BR'));
  });

  it('formatDateTime with explicit opts is byte-identical to native toLocaleString for pt-BR', () => {
    const opts = {
      day: '2-digit' as const,
      month: '2-digit' as const,
      year: 'numeric' as const,
      hour: '2-digit' as const,
      minute: '2-digit' as const,
      timeZone: 'UTC',
    };
    assert.equal(formatDateTime(FIXED_UTC, opts, 'pt-BR'), FIXED_UTC.toLocaleString('pt-BR', opts));
  });

  it('formatTime matches Intl.DateTimeFormat for es-PY', () => {
    const opts = { hour: '2-digit' as const, minute: '2-digit' as const, timeZone: 'UTC' };
    assert.equal(
      formatTime(FIXED_UTC, opts, 'es-PY'),
      new Intl.DateTimeFormat('es-PY', opts).format(FIXED_UTC),
    );
  });

  it('formatTime without opts is byte-identical to native toLocaleTimeString for pt-BR', () => {
    assert.equal(formatTime(FIXED_UTC, undefined, 'pt-BR'), FIXED_UTC.toLocaleTimeString('pt-BR'));
  });

  it('formatNumber formats with en-US grouping/decimals', () => {
    assert.equal(formatNumber(1234.5, { minimumFractionDigits: 2 }, 'en-US'), '1,234.50');
  });

  it('formatNumber matches Intl.NumberFormat for es-PY', () => {
    const opts = { minimumFractionDigits: 2 };
    assert.equal(
      formatNumber(1234.5, opts, 'es-PY'),
      new Intl.NumberFormat('es-PY', opts).format(1234.5),
    );
  });

  it('localeCompareActive orders accented strings like native localeCompare for pt-BR', () => {
    assert.equal(localeCompareActive('á', 'b', 'pt-BR'), 'á'.localeCompare('b', 'pt-BR'));
    assert.ok(localeCompareActive('á', 'b', 'pt-BR') < 0);
  });

  it('getActiveLocale returns a SUPPORTED_LOCALES member', () => {
    const active = getActiveLocale();
    assert.ok(['pt-BR', 'es-PY', 'en-US'].includes(active));
  });

  it('getActiveLocale falls back to DEFAULT_LOCALE for an unsupported i18n.language value', () => {
    const saved = i18n.language;
    try {
      i18n.language = 'xx-XX';
      assert.equal(getActiveLocale(), DEFAULT_LOCALE);
    } finally {
      i18n.language = saved;
    }
  });
});
