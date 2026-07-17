import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDocument, formatDocumentForReview } from '../src/lib/reviewDisplay';

describe('formatDocumentForReview - masking per country (individual)', () => {
  it('mascara CPF preservando os 3 primeiros e 2 últimos dígitos', () => {
    assert.equal(formatDocumentForReview('52998224725', 'BR', 'individual'), '529.***.***-25');
  });

  it('mascara SSN revelando apenas os últimos 4 dígitos', () => {
    assert.equal(formatDocumentForReview('123456789', 'US', 'individual'), '***-**-6789');
  });

  it('mascara CI revelando apenas os últimos 3 dígitos', () => {
    assert.equal(formatDocumentForReview('1234567', 'PY', 'individual'), '*.***.567');
  });
});

describe('formatDocumentForReview - company documents shown in full', () => {
  it('exibe CNPJ por completo', () => {
    assert.equal(
      formatDocumentForReview('11222333000181', 'BR', 'company'),
      '11.222.333/0001-81',
    );
  });

  it('exibe EIN por completo', () => {
    assert.equal(formatDocumentForReview('123456789', 'US', 'company'), '12-3456789');
  });

  it('exibe RUC por completo', () => {
    assert.equal(formatDocumentForReview('800177266', 'PY', 'company'), '80017726-6');
  });
});

describe('formatDocument - full, unmasked', () => {
  it('formata CPF completo sem máscara', () => {
    assert.equal(formatDocument('12345678901', 'BR', 'individual'), '123.456.789-01');
  });
});

describe('back-compat: legacy TaxIdKind overload (BR-only callers)', () => {
  it('formatDocumentForReview(value, "CPF") mantém a máscara atual', () => {
    assert.equal(formatDocumentForReview('52998224725', 'CPF'), '529.***.***-25');
  });

  it('formatDocument(value, "CNPJ") mantém o formato completo atual', () => {
    assert.equal(formatDocument('11222333000181', 'CNPJ'), '11.222.333/0001-81');
  });

  it('formatDocument(value) usa CNPJ como default, igual ao comportamento anterior', () => {
    assert.equal(formatDocument('11222333000181'), '11.222.333/0001-81');
  });
});

describe('empty input', () => {
  it('formatDocument retorna em-dash para valor vazio', () => {
    assert.equal(formatDocument('', 'BR', 'individual'), '—');
  });

  it('formatDocumentForReview retorna em-dash para valor vazio', () => {
    assert.equal(formatDocumentForReview('', 'BR', 'individual'), '—');
  });
});
