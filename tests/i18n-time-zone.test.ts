import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { formatDate, formatDateTime } from '../src/i18n/formats.ts';
import { getProfileTimeZone, setProfileTimeZone } from '../src/i18n/timeZone.ts';
import { formatDate as formatShortDate, formatDateTime as formatShortDateTime } from '../src/lib/utils.ts';

// Fora do Vite o i18n não é iniciado e o idioma cai no pt-BR: os formatos abaixo são os dele.
describe('fuso do perfil', () => {
  afterEach(() => setProfileTimeZone(null));

  it('instante é lido no fuso do perfil, e o dia muda conforme ele', () => {
    const instant = '2026-03-15T02:00:00Z';

    setProfileTimeZone('America/New_York');
    assert.equal(formatDateTime(instant), '14/03/2026, 22:00');
    assert.equal(formatShortDateTime(instant), '14 mar 2026, 22:00');

    setProfileTimeZone('Asia/Tokyo');
    assert.equal(formatDateTime(instant), '15/03/2026, 11:00');
    assert.equal(formatShortDate(instant), '15 mar 2026');
  });

  it('data de calendário não passa por fuso', () => {
    for (const zone of ['America/New_York', 'Asia/Tokyo', 'America/Sao_Paulo']) {
      setProfileTimeZone(zone);
      assert.equal(formatDate('2026-03-15'), '15/03/2026', zone);
      assert.equal(formatShortDate('2026-03-15'), '15 mar 2026', zone);
    }
  });

  it('timeZone explícito nas opções vence o do perfil', () => {
    setProfileTimeZone('America/New_York');
    assert.equal(
      formatDate(new Date('2026-03-15T00:00:00Z'), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      '15/03/2026',
    );
  });

  it('fuso inválido é ignorado em vez de derrubar a formatação', () => {
    setProfileTimeZone('Marte/Olympus');
    assert.equal(getProfileTimeZone(), undefined);
    assert.equal(formatDate('2026-03-15'), '15/03/2026');
  });
});
