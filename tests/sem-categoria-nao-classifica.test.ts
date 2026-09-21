import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isUncategorizedCategory,
  UNCATEGORIZED_CATEGORY_NAME,
  UNCATEGORIZED_CATEGORY_SLUG,
} from '../shared/systemCategory.js';
import { retrieveChunksForClassification } from '../server/services/hybridChunkRetriever.js';
import type { DocumentClassRule } from '../server/ai/types/documentAi.types.js';
import type { DocumentChunk } from '../server/ai/types/documentAi.types.js';

/**
 * "Sem categoria" é destino de fracasso, não opção de classificação.
 *
 * Relatado em 21/09/2026: um currículo foi arquivado em "Sem categoria". A pasta ia ao
 * classificador como prateleira legítima, e a descrição dela — "Documentos que chegaram sem
 * classificação" — descreve perfeitamente qualquer documento difícil. O modelo arquivava ali com
 * confiança, e aí o documento não ganhava metadado (a regra padrão da pasta não descreve nada) e
 * a proposta de categoria nova nunca era pedida, porque para o código a classificação dera certo.
 */
function rule(id: string, name: string): DocumentClassRule {
  return {
    id,
    name,
    description: `Pasta ${name}`,
    keywords: [],
    fields: [],
    namingTemplate: '{titulo}',
  };
}

/** A mesma filtragem que `analyzePdfService` aplica antes de falar com o modelo. */
function classifiable(rules: DocumentClassRule[]): DocumentClassRule[] {
  return rules.filter((entry) => !isUncategorizedCategory({ id: entry.id, name: entry.name }));
}

describe('a pasta de sistema fora da classificação', () => {
  it('reconhece a pasta de sistema pelo id, pelo slug e pelo nome', () => {
    assert.ok(isUncategorizedCategory({ id: 'cat_sem_categoria' }));
    assert.ok(isUncategorizedCategory({ id: 'cat_sem_categoria__t1' }));
    assert.ok(isUncategorizedCategory({ slug: UNCATEGORIZED_CATEGORY_SLUG }));
    assert.ok(isUncategorizedCategory({ name: UNCATEGORIZED_CATEGORY_NAME }));
    assert.ok(!isUncategorizedCategory({ id: 'cat_curriculos', name: 'Currículos' }));
  });

  it('some da lista que vai ao modelo, e as outras ficam', () => {
    const rules = [
      rule('cat_contratos', 'Contratos'),
      rule('cat_sem_categoria', UNCATEGORIZED_CATEGORY_NAME),
      rule('cat_nf', 'Notas Fiscais'),
    ];

    const visiveis = classifiable(rules).map((entry) => entry.id);
    assert.deepEqual(visiveis, ['cat_contratos', 'cat_nf']);
  });

  it('tenant cuja única pasta é a de sistema não oferece nenhuma escolha ao modelo', () => {
    // É o caso do currículo: sem pasta que sirva, a resposta certa é propor uma, não arquivar
    // no depósito. Com a pasta na lista, o modelo escolhia o depósito e o assunto morria ali.
    const rules = [rule('cat_sem_categoria__t1', UNCATEGORIZED_CATEGORY_NAME)];
    assert.deepEqual(classifiable(rules), []);
  });

  it('sem classe nenhuma, o documento ainda chega inteiro ao modelo', () => {
    /**
     * A seleção de trechos é guiada pelas palavras das classes. Sem classe, nada casa — e se ela
     * devolvesse vazio, o classificador e a proposta receberiam um documento em branco, que é
     * pior que o defeito original. O retriever cai nos primeiros trechos, e é disso que a
     * proposta de pasta nova depende.
     */
    const chunks: DocumentChunk[] = [
      { id: 'c1', text: 'Currículo de Ana Souza. Experiência em logística.', pageNumber: 1 },
      { id: 'c2', text: 'Formação: Administração. Idiomas: inglês avançado.', pageNumber: 1 },
    ] as unknown as DocumentChunk[];

    const selecionados = retrieveChunksForClassification({ chunks, classes: [] });

    assert.ok(selecionados.length > 0, 'sem trecho não há o que classificar nem o que propor');
    assert.ok(selecionados.some((chunk) => chunk.text.includes('Currículo')));
  });

  it('a pasta de sistema continua existindo para quem escolhe à mão', () => {
    // Filtrar é só para o modelo. Ela segue sendo destino da confirmação e opção na revisão —
    // o que muda é que deixou de ser resposta automática.
    const rules = [
      rule('cat_sem_categoria', UNCATEGORIZED_CATEGORY_NAME),
      rule('cat_contratos', 'Contratos'),
    ];

    assert.equal(rules.length, 2, 'a filtragem não pode apagar a pasta do catálogo do tenant');
    assert.equal(classifiable(rules).length, 1);
  });
});
