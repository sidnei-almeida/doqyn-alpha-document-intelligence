import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatCnpj,
  formatCpf,
  formatTaxId,
  isCompleteTaxId,
  toTaxIdApiValue,
} from '../src/lib/identifiers/taxId';
import {
  formatWhatsapp,
  isCompleteWhatsapp,
  toWhatsappApiValue,
} from '../src/lib/identifiers/whatsapp';

describe('identifier formatters', () => {
  describe('CPF', () => {
    it('formata enquanto digita', () => {
      assert.equal(formatCpf('1'), '1');
      assert.equal(formatCpf('123'), '123');
      assert.equal(formatCpf('123456'), '123.456');
      assert.equal(formatCpf('123456789'), '123.456.789');
      assert.equal(formatCpf('12345678901'), '123.456.789-01');
    });

    it('normaliza colagem com pontuação', () => {
      assert.equal(formatCpf('123.456.789-01'), '123.456.789-01');
      assert.equal(toTaxIdApiValue('123.456.789-01'), '12345678901');
    });

    it('limita a 11 dígitos', () => {
      assert.equal(formatCpf('123456789012345'), '123.456.789-01');
    });
  });

  describe('CNPJ', () => {
    it('formata enquanto digita', () => {
      assert.equal(formatCnpj('11222333000181'), '11.222.333/0001-81');
    });

    it('normaliza colagem', () => {
      assert.equal(formatTaxId('11.222.333/0001-81', 'CNPJ'), '11.222.333/0001-81');
      assert.equal(toTaxIdApiValue('11.222.333/0001-81'), '11222333000181');
    });
  });

  describe('validação de completude', () => {
    it('detecta CPF/CNPJ completos', () => {
      assert.equal(isCompleteTaxId('123.456.789-01', 'CPF'), true);
      assert.equal(isCompleteTaxId('123.456.789-0', 'CPF'), false);
      assert.equal(isCompleteTaxId('11.222.333/0001-81', 'CNPJ'), true);
    });
  });

  describe('WhatsApp', () => {
    it('formata número BR sem DDI', () => {
      assert.equal(formatWhatsapp('11999998888'), '+55 (11) 99999-8888');
    });

    it('formata colagem com espaços e hífen', () => {
      assert.equal(formatWhatsapp('+55 11 99999-8888'), '+55 (11) 99999-8888');
      assert.equal(formatWhatsapp('(11) 99999-8888'), '+55 (11) 99999-8888');
    });

    it('envia E.164 sem + para API', () => {
      assert.equal(toWhatsappApiValue('(11) 99999-8888'), '5511999998888');
      assert.equal(toWhatsappApiValue('+55 11 99999-8888'), '5511999998888');
    });

    it('valida comprimento mínimo', () => {
      assert.equal(isCompleteWhatsapp('+55 (11) 99999-8888'), true);
      assert.equal(isCompleteWhatsapp('+55 (11) 9999'), false);
    });
  });
});
