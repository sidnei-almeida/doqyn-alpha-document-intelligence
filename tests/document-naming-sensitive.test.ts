import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateRecommendedFileName,
  stripSensitiveIdentifiersFromFileName,
} from '../server/ai/services/documentNaming.js';

describe('documentNaming sensitive data', () => {
  it('stripSensitiveIdentifiersFromFileName remove CPF de 11 dígitos', () => {
    const result = stripSensitiveIdentifiersFromFileName('NDA_12345678901_Acme.pdf');
    assert.equal(result.includes('12345678901'), false);
    assert.equal(result.endsWith('.pdf'), true);
  });

  it('stripSensitiveIdentifiersFromFileName remove CNPJ de 14 dígitos', () => {
    const result = stripSensitiveIdentifiersFromFileName('Nota_12345678000199_Fornecedor.pdf');
    assert.equal(result.includes('12345678000199'), false);
  });

  it('generateRecommendedFileName aplica strip por padrão', () => {
    const result = generateRecommendedFileName({
      originalFileName: 'upload.pdf',
      selectedClass: {
        id: 'class_1',
        name: 'NDA',
        description: 'NDA',
        keywords: ['nda'],
        fields: [],
        namingTemplate: 'NDA_{fornecedor}_{numero_nota}',
      },
      metadata: {
        fornecedor: {
          key: 'fornecedor',
          label: 'Fornecedor',
          value: '12345678901',
          normalizedValue: '12345678901',
          confidence: 1,
        },
        numero_nota: {
          key: 'numero_nota',
          label: 'Número',
          value: '42',
          normalizedValue: '42',
          confidence: 1,
        },
      },
      version: 'v1',
    });

    assert.equal(result.includes('12345678901'), false);
    assert.equal(result.endsWith('.pdf'), true);
  });

  it('generateRecommendedFileName pode desligar strip explicitamente', () => {
    const result = generateRecommendedFileName({
      originalFileName: 'upload.pdf',
      selectedClass: {
        id: 'class_1',
        name: 'NDA',
        description: 'NDA',
        keywords: ['nda'],
        fields: [],
        namingTemplate: 'NDA_{fornecedor}',
      },
      metadata: {
        fornecedor: {
          key: 'fornecedor',
          label: 'Fornecedor',
          value: '12345678901',
          normalizedValue: '12345678901',
          confidence: 1,
        },
      },
      version: 'v1',
      preventSensitiveDataInFileName: false,
    });

    assert.equal(result.includes('12345678901'), true);
  });
});
