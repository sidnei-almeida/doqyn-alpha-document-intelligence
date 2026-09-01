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

  it('imagem continua imagem: a extensão do arquivo original é preservada', () => {
    // O nome saía sempre com `.pdf`, herança de quando só PDF entrava. Desde que
    // o OCR passou a ler foto de documento, um `.png` renomeado para `.pdf` fica
    // com o nome mentindo sobre o próprio conteúdo.
    const name = generateRecommendedFileName({
      originalFileName: 'foto-do-atestado.png',
      selectedClass: genericClass,
      metadata: {},
      version: 'v1.0',
      namingRoles: {
        tipo: 'ATESTADO MÉDICO',
        sujeitos: ['Neusa Kliemann Vargas'],
        dataReferencia: '2026-05-09',
      },
    });

    assert.ok(name.endsWith('.png'), `deveria terminar em .png: ${name}`);
    assert.match(name, /^ATESTADO_MEDICO/, name);
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

describe('o tipo lido vence a pasta escolhida', () => {
  /** Classe de confidencialidade: o gerador tem um resgate próprio para ela. */
  const juridico = {
    id: 'cat_juridico',
    name: 'Jurídico',
    description: 'Documentos jurídicos, NDAs e compliance.',
    keywords: ['nda', 'confidencialidade'],
    namingTemplate: '{parte_reveladora}_{parte_receptora}_{data_assinatura}_v{version}',
    fields: [],
  } as unknown as DocumentClassRule;

  it('procuração arquivada em Jurídico não vira NDA', () => {
    // O resgate existe para NDA que saiu sem as partes, e passava por cima de
    // nome bom: uma procuração não tem `parte_reveladora` para o teste achar, e
    // o nome virava `NDA_2026-04-13` — perdendo tipo, outorgante e outorgada.
    const name = generateRecommendedFileName({
      originalFileName: 'scan.pdf',
      selectedClass: juridico,
      metadata: {},
      version: 'v1.0',
      namingRoles: {
        tipo: 'PROCURAÇÃO',
        sujeitos: ['Otávio Pilar Bandeira Neto', 'Solange Ferrari Duprat'],
        dataReferencia: '2026-04-13',
      },
    });

    assert.match(name, /^PROCURACAO_/, name);
    assert.match(name, /OTAVIO/, name);
    assert.ok(!name.startsWith('NDA'), `não deveria virar NDA: ${name}`);
  });

  it('sem sujeito nenhum, o resgate da classe continua valendo', () => {
    const name = generateRecommendedFileName({
      originalFileName: 'scan.pdf',
      selectedClass: juridico,
      metadata: {},
      version: 'v1.0',
      namingRoles: { tipo: 'PROCURAÇÃO', sujeitos: [], dataReferencia: '2026-04-13' },
    });

    // Tipo sozinho não distingue dois documentos; aqui o caminho antigo assume.
    assert.ok(!name.startsWith('PROCURACAO_2026'), name);
  });
});
