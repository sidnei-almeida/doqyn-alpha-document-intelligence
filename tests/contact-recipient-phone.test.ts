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
});
