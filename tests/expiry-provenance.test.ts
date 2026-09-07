import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveExpiryProvenance } from '../server/ai/utils/expiryProvenance.js';
import type {
  DocumentClassRule,
  ExtractedMetadataField,
} from '../server/ai/types/documentAi.types.js';

const CONTRATOS: DocumentClassRule = {
  id: 'cat_ctr',
  name: 'Contratos',
  description: 'Contratos e acordos.',
  keywords: ['contrato'],
  fields: [
    { key: 'data_referencia', label: 'Data de referência', type: 'date', required: true },
    { key: 'data_vencimento', label: 'Data de vencimento', type: 'date', required: true },
  ],
  namingTemplate: '{data_referencia}',
};

const SEM_VALIDADE: DocumentClassRule = {
  ...CONTRATOS,
  fields: [{ key: 'data_referencia', label: 'Data de referência', type: 'date', required: true }],
};

const vencimento = (over: Partial<ExtractedMetadataField>): ExtractedMetadataField => ({
  label: 'Data de vencimento',
  value: '2029-06-09',
  normalizedValue: '2029-06-09',
  confidence: 0.9,
  source: 'document_text',
  ...over,
});

describe('origem da data de vencimento', () => {
  it('data escrita no documento conta como lida', () => {
    assert.equal(
      resolveExpiryProvenance(CONTRATOS, { data_vencimento: vencimento({}) }),
      'lido',
    );
  });

  it('separa prazo vindo de campo de prazo vindo do corpo', () => {
    assert.equal(
      resolveExpiryProvenance(CONTRATOS, {
        data_vencimento: vencimento({ source: 'derived', derivedFrom: 'campo' }),
      }),
      'derivado_de_campo',
    );
    assert.equal(
      resolveExpiryProvenance(CONTRATOS, {
        data_vencimento: vencimento({ source: 'derived', derivedFrom: 'texto' }),
      }),
      'derivado_de_texto',
    );
  });

  it('campo vazio é ausência — o documento cujo alerta nunca dispara', () => {
    assert.equal(
      resolveExpiryProvenance(CONTRATOS, { data_vencimento: vencimento({ value: null, normalizedValue: null }) }),
      'ausente',
    );
    assert.equal(resolveExpiryProvenance(CONTRATOS, {}), 'ausente');
  });

  it('classe sem campo de data final não é falha e não entra na conta', () => {
    assert.equal(resolveExpiryProvenance(SEM_VALIDADE, {}), 'sem_campo');
  });
});
