import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  defaultPhoneCountry,
  formatPhone,
  isCompletePhone,
  toE164,
  toE164Plus,
} from '../src/lib/identifiers/phone';

describe('phone country registry', () => {
  describe('BR', () => {
    it('converte para E.164 sem e com +', () => {
      assert.equal(toE164('+55 54 99999-9999', 'BR'), '5554999999999');
      assert.equal(toE164Plus('+55 54 99999-9999', 'BR'), '+5554999999999');
    });

    it('formata a partir do E.164', () => {
      assert.equal(formatPhone('5554999999999', 'BR'), '+55 54 99999 9999');
    });

    it('valida completude', () => {
      assert.equal(isCompletePhone('5554999999999', 'BR'), true);
    });
  });

  describe('PY', () => {
    it('converte para E.164 com e sem dial code explícito', () => {
      assert.equal(toE164('+595 981 234 567', 'PY'), '595981234567');
      assert.equal(toE164('981234567', 'PY'), '595981234567');
    });

    it('formata a partir do E.164', () => {
      assert.equal(formatPhone('595981234567', 'PY'), '+595 981 234567');
    });

    it('valida completude', () => {
      assert.equal(isCompletePhone('595981234567', 'PY'), true);
      assert.equal(isCompletePhone('59598123', 'PY'), false);
    });
  });

  describe('US', () => {
    it('converte para E.164 com e sem dial code explícito', () => {
      assert.equal(toE164('+1 (202) 555-0123', 'US'), '12025550123');
      assert.equal(toE164('2025550123', 'US'), '12025550123');
    });

    it('formata a partir do E.164', () => {
      assert.equal(formatPhone('12025550123', 'US'), '+1 202 555 0123');
    });

    it('valida completude', () => {
      assert.equal(isCompletePhone('12025550123', 'US'), true);
    });
  });

  describe('BR regression', () => {
    it('mantém o E.164 (formato de fio) idêntico ao comportamento atual — a máscara de exibição pode variar entre libphonenumber-js e a implementação manual anterior', () => {
      assert.equal(toE164('+55 54 99999-9999', 'BR'), '5554999999999');
      assert.equal(formatPhone('5554999999999', 'BR'), '+55 54 99999 9999');
    });
  });

  describe('defaultPhoneCountry', () => {
    it('mapeia locale para país', () => {
      assert.equal(defaultPhoneCountry('pt-BR'), 'BR');
      assert.equal(defaultPhoneCountry('es-PY'), 'PY');
      assert.equal(defaultPhoneCountry('en-US'), 'US');
    });
  });
});
