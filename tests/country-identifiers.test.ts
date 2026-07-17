import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatCnpj,
  formatCpf,
  isCompleteTaxId,
  validateCnpj,
  validateCpf,
} from '../src/lib/identifiers/taxId';
import {
  defaultCountryForLocale,
  getIdentifierSpec,
  SUPPORTED_COUNTRIES,
} from '../src/lib/identifiers/countryIdentifiers';

describe('BR check digits', () => {
  it('valida CPF com dígitos verificadores corretos', () => {
    assert.equal(validateCpf('529.982.247-25'), true);
  });

  it('rejeita CPF com dígitos verificadores incorretos', () => {
    assert.equal(validateCpf('529.982.247-20'), false);
  });

  it('rejeita CPF com sequência de dígitos repetidos', () => {
    assert.equal(validateCpf('111.111.111-11'), false);
  });

  it('rejeita CPF incompleto', () => {
    assert.equal(validateCpf('123.456.789'), false);
  });

  it('valida CNPJ com dígitos verificadores corretos', () => {
    assert.equal(validateCnpj('11.222.333/0001-81'), true);
  });

  it('rejeita CNPJ com dígito verificador incorreto', () => {
    assert.equal(validateCnpj('11.222.333/0001-80'), false);
  });
});

describe('BR regression', () => {
  it('mantém format/completude do CPF/CNPJ inalterados', () => {
    assert.equal(formatCpf('12345678901'), '123.456.789-01');
    assert.equal(formatCnpj('11222333000181'), '11.222.333/0001-81');
    assert.equal(isCompleteTaxId('123.456.789-01', 'CPF'), true);
    assert.equal(isCompleteTaxId('123.456.789-0', 'CPF'), false);
    assert.equal(isCompleteTaxId('11.222.333/0001-81', 'CNPJ'), true);
  });
});

describe('getIdentifierSpec routing', () => {
  it('roteia BR individual/company para CPF/CNPJ', () => {
    assert.equal(getIdentifierSpec('BR', 'individual').format('12345678901'), '123.456.789-01');
    assert.equal(getIdentifierSpec('BR', 'company').validate('11.222.333/0001-81'), true);
    assert.equal(getIdentifierSpec('BR', 'individual').code, 'CPF');
    assert.equal(getIdentifierSpec('BR', 'company').code, 'CNPJ');
  });

  it('roteia PY individual/company para CI/RUC', () => {
    assert.equal(getIdentifierSpec('PY', 'individual').code, 'CI');
    assert.equal(getIdentifierSpec('PY', 'company').code, 'RUC');
  });

  it('roteia US individual/company para SSN/EIN', () => {
    assert.equal(getIdentifierSpec('US', 'individual').code, 'SSN');
    assert.equal(getIdentifierSpec('US', 'company').code, 'EIN');
  });

  it('todo spec normaliza para dígitos e usa inputMode numeric', () => {
    for (const country of SUPPORTED_COUNTRIES) {
      for (const personType of ['individual', 'company'] as const) {
        const spec = getIdentifierSpec(country, personType);
        assert.equal(spec.normalize('ab1.2c3-4'), '1234');
        assert.equal(spec.inputMode, 'numeric');
      }
    }
  });
});

describe('PY CI', () => {
  it('agrupa em milhares', () => {
    assert.equal(getIdentifierSpec('PY', 'individual').format('1234567'), '1.234.567');
    assert.equal(getIdentifierSpec('PY', 'individual').format('12345'), '12.345');
  });

  it('completude exige >=6 dígitos', () => {
    assert.equal(getIdentifierSpec('PY', 'individual').isComplete('12345'), false);
    assert.equal(getIdentifierSpec('PY', 'individual').isComplete('123456'), true);
  });

  it('rejeita mais de 9 dígitos', () => {
    assert.equal(getIdentifierSpec('PY', 'individual').validate('1234567890'), false);
  });
});

describe('PY RUC', () => {
  it('formata base + dígito verificador', () => {
    assert.equal(getIdentifierSpec('PY', 'company').format('800177266'), '80017726-6');
  });

  it('valida dígito verificador mód. 11 correto', () => {
    assert.equal(getIdentifierSpec('PY', 'company').validate('800177266'), true);
  });

  it('rejeita dígito verificador incorreto', () => {
    assert.equal(getIdentifierSpec('PY', 'company').validate('800177261'), false);
  });
});

describe('US SSN', () => {
  it('formata progressivamente', () => {
    assert.equal(getIdentifierSpec('US', 'individual').format('123456789'), '123-45-6789');
  });

  it('valida SSN correto', () => {
    assert.equal(getIdentifierSpec('US', 'individual').validate('123-45-6789'), true);
  });

  it('rejeita área 666', () => {
    assert.equal(getIdentifierSpec('US', 'individual').validate('666-45-6789'), false);
  });

  it('rejeita área 000', () => {
    assert.equal(getIdentifierSpec('US', 'individual').validate('000-45-6789'), false);
  });

  it('rejeita área 900-999', () => {
    assert.equal(getIdentifierSpec('US', 'individual').validate('900-45-6789'), false);
  });

  it('rejeita grupo 00', () => {
    assert.equal(getIdentifierSpec('US', 'individual').validate('123-00-6789'), false);
  });

  it('rejeita série 0000', () => {
    assert.equal(getIdentifierSpec('US', 'individual').validate('123-45-0000'), false);
  });
});

describe('US EIN', () => {
  it('formata progressivamente', () => {
    assert.equal(getIdentifierSpec('US', 'company').format('123456789'), '12-3456789');
  });

  it('valida exatamente 9 dígitos', () => {
    assert.equal(getIdentifierSpec('US', 'company').validate('12-3456789'), true);
    assert.equal(getIdentifierSpec('US', 'company').validate('1-3456789'), false);
  });
});

describe('defaultCountryForLocale', () => {
  it('mapeia os três locales suportados', () => {
    assert.equal(defaultCountryForLocale('pt-BR'), 'BR');
    assert.equal(defaultCountryForLocale('es-PY'), 'PY');
    assert.equal(defaultCountryForLocale('en-US'), 'US');
  });
});
