import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatBooleanConsent,
  formatDocument,
  formatDocumentForReview,
  formatPhone,
  PASSWORD_REVIEW_LABEL,
  safeDisplayValue,
} from '../src/lib/reviewDisplay';

describe('reviewDisplay', () => {
  it('safeDisplayValue retorna traço para vazio', () => {
    assert.equal(safeDisplayValue(''), '—');
    assert.equal(safeDisplayValue('  '), '—');
    assert.equal(safeDisplayValue('João'), 'João');
  });

  it('formatDocument formata CNPJ', () => {
    assert.equal(formatDocument('12345678000199', 'CNPJ'), '12.345.678/0001-99');
  });

  it('formatDocumentForReview mascara CPF parcialmente', () => {
    assert.equal(formatDocumentForReview('12345678901', 'CPF'), '123.***.***-01');
    assert.equal(formatDocumentForReview('12345678000199', 'CNPJ'), '12.345.678/0001-99');
  });

  it('formatPhone formata WhatsApp', () => {
    assert.match(formatPhone('5511999998888'), /\+55/);
  });

  it('formatBooleanConsent retorna rótulos corretos', () => {
    assert.equal(formatBooleanConsent(true, 'Sim', 'Não'), 'Sim');
    assert.equal(formatBooleanConsent(false, 'Sim', 'Não'), 'Não');
  });

  it('PASSWORD_REVIEW_LABEL não expõe senha', () => {
    assert.match(PASSWORD_REVIEW_LABEL, /não exibida/i);
    assert.equal(PASSWORD_REVIEW_LABEL.includes('senha-segura'), false);
  });
});
