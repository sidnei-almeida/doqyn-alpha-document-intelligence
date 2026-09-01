import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateRecommendedFileName } from '../server/ai/services/documentNaming.js';
import type { DocumentClassRule } from '../server/ai/types/documentAi.types.js';

/** Classe genérica, como a que o usuário realmente cria: pasta, sem campos de tipo nenhum. */
const genericClass = {
  id: 'cat_gerais',
  name: 'Documentos Gerais',
  description: 'Pasta genérica',
  namingTemplate: '{referencia}_{titulo}_{data_assinatura}_v{version}',
  fields: [],
} as unknown as DocumentClassRule;

describe('nome a partir dos papéis entendidos pela IA', () => {
  it('nomeia um tipo que ninguém cadastrou, sem campo autorado', () => {
    const name = generateRecommendedFileName({
      originalFileName: 'scan001.pdf',
      selectedClass: genericClass,
      metadata: {},
      version: 'v1.0',
      namingRoles: {
        tipo: 'RECEITA',
        sujeitos: ['Maria Helena Souza', 'Dr. Paulo Ribeiro'],
        dataReferencia: '2026-06-09',
      },
    });

    assert.match(name, /^RECEITA_/, `deve começar pelo tipo: ${name}`);
    assert.match(name, /Maria/i, `deve conter o sujeito: ${name}`);
    assert.match(name, /2026-06-09/, `deve conter a data: ${name}`);
  });

  it('o nome proposto sai em caixa alta, e só a extensão fica em minúscula', () => {
    // Caixa alta é o que separa, na lista, o nome que o sistema deu do nome que
    // chegou com quem enviou. A extensão fica fora: `.PDF` faz o arquivo parecer
    // vindo de outro sistema.
    const name = generateRecommendedFileName({
      originalFileName: 'scan001.pdf',
      selectedClass: genericClass,
      metadata: {},
      version: 'v1.0',
      namingRoles: {
        tipo: 'RECEITA',
        sujeitos: ['Maria Helena Souza'],
        dataReferencia: '2026-06-09',
      },
    });

    const stem = name.slice(0, name.lastIndexOf('.'));
    assert.equal(stem, stem.toUpperCase(), `o corpo do nome deve ser caixa alta: ${name}`);
    assert.ok(name.endsWith('.pdf'), `a extensão deve ficar em minúscula: ${name}`);
  });

  it('usa o tipo do documento, não o nome da pasta', () => {
    const financeiro = { ...genericClass, name: 'Financeiros' } as DocumentClassRule;

    const nf = generateRecommendedFileName({
      originalFileName: 'a.pdf',
      selectedClass: financeiro,
      metadata: {},
      version: 'v1.0',
      namingRoles: { tipo: 'NOTA FISCAL', sujeitos: ['Acme Ltda'], dataReferencia: '2026-08-06' },
    });

    const reembolso = generateRecommendedFileName({
      originalFileName: 'b.pdf',
      selectedClass: financeiro,
      metadata: {},
      version: 'v1.0',
      namingRoles: { tipo: 'REEMBOLSO', sujeitos: ['Acme Ltda'], dataReferencia: '2026-08-06' },
    });

    // Dois documentos na mesma pasta, nomes distintos — o que não era possível quando o prefixo
    // vinha da categoria.
    assert.match(nf, /^NOTA_FISCAL/i);
    assert.match(reembolso, /^REEMBOLSO/i);
    assert.notEqual(nf, reembolso);
    assert.ok(!nf.startsWith('Financeiros'), `não deve usar a pasta: ${nf}`);
  });

  it('sem sujeito e sem data, deixa o caminho antigo assumir', () => {
    const name = generateRecommendedFileName({
      originalFileName: 'Invoice-BXZYLFIE-0003.pdf',
      selectedClass: genericClass,
      metadata: {},
      version: 'v1.0',
      namingRoles: { tipo: 'NOTA FISCAL', sujeitos: [], dataReferencia: null },
    });

    // Só o tipo não distingue dois documentos; o nome original identifica melhor.
    assert.match(name, /Invoice/i, `deveria cair no nome original: ${name}`);
  });

  it('sem papéis, o comportamento anterior continua valendo', () => {
    const name = generateRecommendedFileName({
      originalFileName: 'Refund-3173-1097.pdf',
      selectedClass: genericClass,
      metadata: {},
      version: 'v1.0',
    });

    assert.match(name, /Refund/i);
  });
});
