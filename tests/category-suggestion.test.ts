import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCategorySuggestion } from '../server/ai/services/categorySuggestionAgent.js';
import { buildCategorySuggestionPrompt } from '../server/ai/utils/categorySuggestionPrompt.js';
import { analysisHasResolvableCategory } from '../src/features/document-send/services/normalizeConfirmPayload.js';
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

  it('recusa nome vazio nos três idiomas da interface', () => {
    // O nome sai no idioma de quem enviou o arquivo, então a guarda tem de valer nos três. Só em
    // português, ela deixava "Files" e "Archivos" virarem pasta.
    for (const name of [
      'Documents',
      'Files',
      'Miscellaneous',
      'Uncategorized',
      'Archivos',
      'Varios',
      'Documentación',
      'Generales',
    ]) {
      assert.equal(parseCategorySuggestion({ ...valid, name }, existing), null, name);
    }
  });

  it('continua aceitando nome de família que separa de verdade', () => {
    // A guarda de nome vazio não pode engolir a proposta boa: "Financeiro" e "Recrutamento" são
    // abrangentes de propósito, e é exatamente o que o prompt passou a pedir.
    for (const name of ['Financeiro', 'Recrutamento', 'Saúde Ocupacional', 'Recruiting']) {
      assert.ok(parseCategorySuggestion({ ...valid, name }, existing), name);
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

describe('auto_create precisa chegar ao servidor', () => {
  /**
   * O modo nasceu inalcançável: três guardas do cliente exigiam `classId`, e a única saída que
   * elas ofereciam — escolher a pasta à mão — grava `manualClassId`, que vence a proposta e faz a
   * criação automática nem ser tentada. O servidor estava certo e coberto por teste; o produto
   * nunca o chamava.
   */
  const analysisWithoutClass = {
    jobId: 'job_1',
    classification: {
      classId: null,
      className: null,
      confidence: 0,
      requiresReview: true,
      reason: 'Nenhuma classe serve.',
      evidence: [],
      suggestedCategory: {
        name: 'Boletos',
        description: 'Boletos bancários e faturas de cobrança.',
        keywords: ['boleto'],
        reason: 'Nada cobre cobrança bancária.',
      },
    },
  } as unknown as Parameters<typeof analysisHasResolvableCategory>[0];

  it('a proposta resolve a categoria em auto_create', () => {
    assert.ok(
      analysisHasResolvableCategory(analysisWithoutClass, {
        categorySuggestionMode: 'auto_create',
      }),
    );
  });

  it('não resolve em suggest nem em off — ali a escolha é humana', () => {
    for (const mode of ['suggest', 'off'] as const) {
      assert.equal(
        analysisHasResolvableCategory(analysisWithoutClass, { categorySuggestionMode: mode }),
        false,
        mode,
      );
    }
  });

  it('auto_create sem proposta continua sem categoria', () => {
    const semProposta = {
      ...analysisWithoutClass,
      classification: { ...analysisWithoutClass.classification, suggestedCategory: null },
    } as typeof analysisWithoutClass;

    assert.equal(
      analysisHasResolvableCategory(semProposta, { categorySuggestionMode: 'auto_create' }),
      false,
    );
  });

  it('as outras três origens continuam valendo sozinhas', () => {
    assert.ok(analysisHasResolvableCategory(analysisWithoutClass, { manualClassId: 'cat_x' }));
    assert.ok(analysisHasResolvableCategory(analysisWithoutClass, { documentRequestId: 'req_x' }));

    const comClasse = {
      ...analysisWithoutClass,
      classification: { ...analysisWithoutClass.classification, classId: 'cat_nf' },
    } as typeof analysisWithoutClass;
    assert.ok(analysisHasResolvableCategory(comClasse));
  });
});

describe('o prompt da proposta pede a família, não o tipo', () => {
  const prompt = buildCategorySuggestionPrompt({
    chunks: [],
    classes: existing,
    documentType: 'NDA',
    firstReason: 'Nenhuma pasta cobre acordo de confidencialidade.',
    outputLocale: 'pt-BR',
  });

  it('nomeia o erro que motivou a regra', () => {
    // Um NDA virava "Acordos de Confidencialidade" e inaugurava a própria pasta. O prompt agora
    // traz o par errado/certo por escrito — sem ele o modelo devolve o nome do documento que leu.
    assert.match(prompt, /FAMÍLIA de documentos, não o nome deste documento/);
    assert.match(prompt, /NÃO "Acordos de Confidencialidade"/);
    assert.match(prompt, /quantos tipos diferentes de documento caberiam nesta pasta/);
  });

  it('mantém o contrapeso contra a pasta que aceita tudo', () => {
    // Pedir amplitude sem teto trocaria uma pasta por documento por uma pasta só, chamada
    // "Documentos" — que é o mesmo que não ter pasta.
    assert.match(prompt, /genérico demais, desça um nível/);
  });

  it('pede o nome no idioma de quem vai ler a pasta', () => {
    for (const [locale, language] of [
      ['pt-BR', 'português'],
      ['en-US', 'inglês'],
      ['es-419', 'espanhol'],
    ] as const) {
      const built = buildCategorySuggestionPrompt({
        chunks: [],
        classes: existing,
        documentType: 'NDA',
        firstReason: 'Nenhuma pasta serve.',
        outputLocale: locale,
      });
      // A quebra de linha do template cai entre "em" e o idioma, então a âncora é o que vem
      // depois dele.
      assert.ok(built.includes(`${language}, do jeito que`), locale);
    }
  });
});
