import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCategorySuggestion } from '../server/ai/services/categorySuggestionAgent.js';
import type { DocumentClassRule } from '../server/ai/types/documentAi.types.js';
import {
  DEFAULT_TENANT_UPLOAD_POLICY,
  isCategorySuggestionMode,
  normalizeTenantUploadPolicy,
} from '../shared/uploadPolicy.js';

function classRule(id: string, name: string): DocumentClassRule {
  return {
    id,
    name,
    description: `Pasta ${name}`,
    keywords: [],
    fields: [],
    namingTemplate: '{titulo}',
  };
}

const existing = [classRule('cat_contratos', 'Contratos'), classRule('cat_nf', 'Notas Fiscais')];

const valid = {
  name: 'Boletos',
  description:
    'Boletos bancários e faturas de cobrança com código de barras, linha digitável e vencimento.',
  keywords: ['boleto', 'código de barras', 'cedente'],
  reason: 'Nenhuma pasta existente cobre cobrança bancária.',
};

describe('proposta de categoria da IA', () => {
  it('aceita a proposta completa e normaliza as palavras-chave', () => {
    const suggestion = parseCategorySuggestion(valid, existing);

    assert.ok(suggestion);
    assert.equal(suggestion!.name, 'Boletos');
    assert.deepEqual(suggestion!.keywords, ['boleto', 'código de barras', 'cedente']);
  });

  it('recusa nome que duplica pasta existente, por nome ou por slug', () => {
    // Criar a segunda "Contratos" seria recusado com DUPLICATE_SLUG depois de já ter pago a
    // chamada — e, pior, é a proposta que o modelo mais tende a fazer.
    assert.equal(parseCategorySuggestion({ ...valid, name: 'Contratos' }, existing), null);
    assert.equal(parseCategorySuggestion({ ...valid, name: 'contratos' }, existing), null);
    assert.equal(parseCategorySuggestion({ ...valid, name: 'Notas fiscais' }, existing), null);
  });

  it('recusa nome vazio de significado', () => {
    // Uma pasta "Documentos" aceita qualquer documento: a empresa troca "Sem categoria" por um
    // sinônimo dela e passa a achar que está resolvido.
    for (const name of ['Documentos', 'Outros', 'Geral', 'arquivos', 'Misc']) {
      assert.equal(parseCategorySuggestion({ ...valid, name }, existing), null, name);
    }
  });

  it('recusa nome longo demais ou com mais de três palavras', () => {
    assert.equal(parseCategorySuggestion({ ...valid, name: 'Bo' }, existing), null);
    assert.equal(
      parseCategorySuggestion({ ...valid, name: 'Boletos de cobrança bancária emitidos' }, existing),
      null,
    );
  });

  it('recusa a proposta sem descrição aproveitável', () => {
    // A descrição é o que o classificador lê no próximo documento; pasta sem ela nasce cega.
    assert.equal(parseCategorySuggestion({ ...valid, description: 'Boletos.' }, existing), null);
    assert.equal(parseCategorySuggestion({ ...valid, description: null }, existing), null);
  });

  it('aceita a primeira pasta de um tenant sem nenhuma categoria', () => {
    const suggestion = parseCategorySuggestion(valid, []);
    assert.ok(suggestion);
  });

  it('limita as palavras-chave a oito e descarta repetição e o próprio nome', () => {
    const suggestion = parseCategorySuggestion(
      {
        ...valid,
        keywords: [
          'boleto',
          'BOLETO',
          'boletos',
          'a',
          'cedente',
          'sacado',
          'vencimento',
          'nosso número',
          'linha digitável',
          'código de barras',
          'juros',
          'multa',
          'desconto',
        ],
      },
      existing,
    );

    assert.ok(suggestion);
    assert.ok(suggestion!.keywords.length <= 8);
    assert.equal(new Set(suggestion!.keywords).size, suggestion!.keywords.length);
    assert.ok(!suggestion!.keywords.includes('a'), 'termo de uma letra não identifica nada');
  });

  it('escreve um motivo mesmo quando o modelo não deu um', () => {
    const suggestion = parseCategorySuggestion({ ...valid, reason: '   ' }, existing);
    assert.ok(suggestion);
    assert.ok(suggestion!.reason.length > 0);
  });

  it('devolve null para resposta inaproveitável', () => {
    assert.equal(parseCategorySuggestion(null, existing), null);
    assert.equal(parseCategorySuggestion({ name: null }, existing), null);
    assert.equal(parseCategorySuggestion('Boletos', existing), null);
  });
});

describe('modo de sugestão de categoria na política do tenant', () => {
  it('nasce em suggest — pasta não aparece sem alguém ver', () => {
    assert.equal(DEFAULT_TENANT_UPLOAD_POLICY.categorySuggestionMode, 'suggest');
    assert.equal(normalizeTenantUploadPolicy(undefined).categorySuggestionMode, 'suggest');
  });

  it('preserva o modo escolhido e descarta valor desconhecido', () => {
    assert.equal(
      normalizeTenantUploadPolicy({ categorySuggestionMode: 'auto_create' }).categorySuggestionMode,
      'auto_create',
    );
    assert.equal(
      normalizeTenantUploadPolicy({ categorySuggestionMode: 'off' }).categorySuggestionMode,
      'off',
    );
    assert.equal(
      normalizeTenantUploadPolicy({
        categorySuggestionMode: 'criar_tudo',
      } as never).categorySuggestionMode,
      'suggest',
    );
  });

  it('reconhece só os três modos', () => {
    assert.ok(isCategorySuggestionMode('off'));
    assert.ok(isCategorySuggestionMode('suggest'));
    assert.ok(isCategorySuggestionMode('auto_create'));
    assert.ok(!isCategorySuggestionMode('auto'));
    assert.ok(!isCategorySuggestionMode(undefined));
  });
});
