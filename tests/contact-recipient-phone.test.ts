import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INVALID_RECIPIENT_PHONE_MESSAGE,
  maskRecipientPhoneForDisplay,
  parseOptionalRecipientPhone,
} from '../server/utils/contactNormalize.js';

describe('recipient phone — normalização externa', () => {
  it('aceita convite sem telefone', () => {
    assert.equal(parseOptionalRecipientPhone(undefined), null);
    assert.equal(parseOptionalRecipientPhone(''), null);
    assert.equal(parseOptionalRecipientPhone('   '), null);
  });

  it('normaliza telefone brasileiro sem DDI', () => {
    const parsed = parseOptionalRecipientPhone('(54) 99999-9999');
    assert.ok(parsed);
    assert.equal(parsed.recipientPhoneNormalized, '+5554999999999');
    assert.equal(parsed.recipientPhoneCountryCode, '55');
    assert.equal(parsed.recipientPhoneMasked, '+55 54 *****-9999');
  });

  it('normaliza telefone com DDI explícito', () => {
    const parsed = parseOptionalRecipientPhone('+55 54 99999-9999');
    assert.ok(parsed);
    assert.equal(parsed.recipientPhoneNormalized, '+5554999999999');
  });

  it('rejeita telefone inválido', () => {
    assert.throws(
      () => parseOptionalRecipientPhone('123'),
      (error: Error) => error.message === INVALID_RECIPIENT_PHONE_MESSAGE,
    );
    assert.throws(
      () => parseOptionalRecipientPhone('abc'),
      (error: Error) => error.message === INVALID_RECIPIENT_PHONE_MESSAGE,
    );
  });

  it('maskRecipientPhoneForDisplay mascara BR', () => {
    assert.equal(maskRecipientPhoneForDisplay('+5554999999999'), '+55 54 *****-9999');
  });

  it('normaliza telefone paraguaio com DDI explícito', () => {
    const parsed = parseOptionalRecipientPhone('+595 981 234 567');
    assert.ok(parsed);
    assert.equal(parsed.recipientPhoneNormalized, '+595981234567');
    assert.equal(parsed.recipientPhoneCountryCode, '595');
    assert.equal(parsed.recipientPhoneMasked, '+595 98 *****-4567');
  });

  it('normaliza telefone americano com DDI explícito', () => {
    const parsed = parseOptionalRecipientPhone('+1 (202) 555-0123');
    assert.ok(parsed);
    assert.equal(parsed.recipientPhoneNormalized, '+12025550123');
    assert.equal(parsed.recipientPhoneCountryCode, '1');
    assert.equal(parsed.recipientPhoneMasked, '+1 (202) *****-0123');
  });

  it('não duplica DDI 55 quando já explícito', () => {
    const parsed = parseOptionalRecipientPhone('+55 54 99999-9999');
    assert.ok(parsed);
    assert.equal(parsed.recipientPhoneNormalized, '+5554999999999');
    assert.equal(parsed.recipientPhoneCountryCode, '55');
  });

  it('não prefixa 55 em número que já começa com dial code conhecido (595) sem "+"', () => {
    const parsed = parseOptionalRecipientPhone('595981234567');
    assert.ok(parsed);
    assert.equal(parsed.recipientPhoneNormalized, '+595981234567');
    assert.equal(parsed.recipientPhoneCountryCode, '595');
  });

  it('mantém conveniência BR para número nacional 11 dígitos sem DDI', () => {
    const parsed = parseOptionalRecipientPhone('(54) 99999-9999');
    assert.ok(parsed);
    assert.equal(parsed.recipientPhoneNormalized, '+5554999999999');
    assert.equal(parsed.recipientPhoneCountryCode, '55');
  });

  it('maskRecipientPhoneForDisplay mascara PY e US', () => {
    assert.equal(maskRecipientPhoneForDisplay('+595981234567'), '+595 98 *****-4567');
    assert.equal(maskRecipientPhoneForDisplay('+12025550123'), '+1 (202) *****-0123');
  });
});
