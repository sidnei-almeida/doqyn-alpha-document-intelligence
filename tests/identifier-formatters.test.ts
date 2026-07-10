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
  formatWhatsappInput,
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
      assert.equal(formatWhatsapp('11999998888'), '+55 11 99999-8888');
    });

    it('formata colagem com espaços e hífen', () => {
      assert.equal(formatWhatsapp('+55 11 99999-8888'), '+55 11 99999-8888');
      assert.equal(formatWhatsapp('(11) 99999-8888'), '+55 11 99999-8888');
    });

    it('permite digitar +55 com DDD 54 sem forçar parênteses', () => {
      assert.equal(formatWhatsapp('+'), '+');
      assert.equal(formatWhatsapp('+55'), '+55');
      assert.equal(formatWhatsapp('+55 54'), '+55 54');
      assert.equal(formatWhatsapp('+55 5499917469'), '+55 54 9991-7469');
    });

    it('não assume DDI brasileiro quando o usuário informa + explícito', () => {
      assert.equal(formatWhatsapp('+1 5551234567'), '+1 555 123 4567');
      assert.equal(toWhatsappApiValue('+1 5551234567'), '15551234567');
    });

    it('envia E.164 sem + para API', () => {
      assert.equal(toWhatsappApiValue('(11) 99999-8888'), '5511999998888');
      assert.equal(toWhatsappApiValue('+55 11 99999-8888'), '5511999998888');
      assert.equal(toWhatsappApiValue('+55 54 99999-9999'), '5554999999999');
    });

    it('valida comprimento mínimo', () => {
      assert.equal(isCompleteWhatsapp('+55 11 99999-8888'), true);
      assert.equal(isCompleteWhatsapp('+55 54 99999-9999'), true);
      assert.equal(isCompleteWhatsapp('+55 11 9999'), false);
    });

    it('formata celular BR completo com 13 dígitos', () => {
      assert.equal(formatWhatsapp('+5554991746969'), '+55 54 99174-6969');
      assert.equal(toWhatsappApiValue('+55 54 99174-6969'), '5554991746969');
    });

    it('não duplica DDI 55 em números que já começam com 55', () => {
      assert.equal(toWhatsappApiValue('5554991746969'), '5554991746969');
      assert.equal(formatWhatsapp('5554991746969'), '+55 54 99174-6969');
    });

    it('digitar e apagar não corrompe para sequência de 5s', () => {
      let displayed = '';
      for (const ch of '+5554991746969') {
        displayed = formatWhatsappInput(displayed, displayed + ch);
      }
      assert.equal(displayed, '+55 54 99174-6969');

      for (let i = 0; i < 40; i += 1) {
        const next = displayed.slice(0, -1);
        const formatted = formatWhatsappInput(displayed, next);
        assert.notEqual(
          formatted,
          '+55 55 55555-5555',
          `backspace corrompeu em ${JSON.stringify(next)}`,
        );
        displayed = formatted;
        if (!displayed || displayed === '+') break;
      }
    });

    it('backspace reduz dígitos mesmo com hífen no meio', () => {
      assert.equal(
        formatWhatsappInput('+55 54 9917-469', '+55 54 9917-46'),
        '+55 54 9917-46',
      );
      assert.equal(
        formatWhatsappInput('+55 54 99174-6969', '+55 54 99174-696'),
        '+55 54 9917-4696',
      );
    });
  });
});
