import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatCnpj,
  formatCpf,
  isCompleteTaxId,
  validateCnpj,
  validateCpf,
} from '../src/lib/identifiers/taxId';

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
