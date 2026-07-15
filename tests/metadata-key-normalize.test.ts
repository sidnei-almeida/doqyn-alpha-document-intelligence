import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canonicalizeMetadataKey,
  dedupeMetadataRecord,
  resolveMetadataLabel,
} from '../shared/metadataKeyNormalize.ts';
import { buildVersionComparisonRows } from '../src/features/document-update-version/utils/versionComparison.ts';
import type { AnalyzePdfResponse } from '../src/features/document-send/services/analyzePdf.ts';
import type { DocumentDetailResponse } from '../src/types/document-library.ts';

describe('metadataKeyNormalize', () => {
  it('unifica capitalizações e labels em chave canônica', () => {
    assert.equal(canonicalizeMetadataKey('Parte Reveladora'), 'parte_reveladora');
    assert.equal(canonicalizeMetadataKey('parte reveladora'), 'parte_reveladora');
    assert.equal(canonicalizeMetadataKey('parte_reveladora'), 'parte_reveladora');
    assert.equal(canonicalizeMetadataKey('Data De Assinatura'), 'data_assinatura');
    assert.equal(canonicalizeMetadataKey('Data de assinatura'), 'data_assinatura');
    assert.equal(canonicalizeMetadataKey('data_assinatura'), 'data_assinatura');
  });

  it('resolve labels estáveis', () => {
    assert.equal(resolveMetadataLabel('parte_reveladora', 'parte reveladora'), 'Parte reveladora');
    assert.equal(resolveMetadataLabel('Parte Reveladora'), 'Parte reveladora');
    assert.equal(resolveMetadataLabel('data_assinatura', 'Data De Assinatura'), 'Data de assinatura');
  });

  it('dedupeMetadataRecord funde duplicatas por capitalização', () => {
    const deduped = dedupeMetadataRecord({
      'Parte Reveladora': {
        label: 'Parte Reveladora',
        value: 'Cristiano Rafael Baldissera',
        confidence: 0.9,
      },
      parte_reveladora: {
        label: 'parte reveladora',
        value: 'Cristiano Rafael Baldissera',
        confidence: 0.8,
      },
      'Data De Assinatura': {
        label: 'Data De Assinatura',
        value: '2026-06-09',
        confidence: 0.7,
      },
    });

    assert.deepEqual(Object.keys(deduped).sort(), ['data_assinatura', 'parte_reveladora']);
    assert.equal(deduped.parte_reveladora.label, 'Parte reveladora');
    assert.equal(deduped.data_assinatura.label, 'Data de assinatura');
  });
});

describe('buildStandardDetailsFields', () => {
  it('monta ficha standard com validade inferida', async () => {
    const { buildStandardDetailsFields } = await import(
      '../src/features/document-update-version/utils/documentMetadataDisplay.ts'
    );

    const fields = buildStandardDetailsFields({
      metadata: {
        parte_reveladora: 'Empresa A',
        parte_receptora: 'Empresa B',
        data_assinatura: '2024-01-15',
        prazo_vigencia: '5 anos',
        multa_penalidade: 'R$ 10.000',
      },
      searchMeta: {
        people: [
          { name: 'Empresa A', role: 'parte_reveladora' },
          { name: 'Empresa B', role: 'parte_receptora' },
        ],
        dates: [
          {
            kind: 'validade',
            date: '2029-01-15T00:00:00.000Z',
            label: 'Prazo de vigência (inferido de data_assinatura)',
          },
        ],
        validityDate: '2029-01-15T00:00:00.000Z',
      },
    });

    const keys = fields.map((f) => f.key);
    assert.ok(keys.includes('parte_reveladora'));
    assert.ok(keys.includes('parte_receptora'));
    assert.ok(keys.includes('data_assinatura'));
    assert.ok(keys.includes('prazo_vigencia'));
    assert.ok(keys.includes('validity'));
    assert.ok(!keys.includes('multa_penalidade'));

    const validity = fields.find((f) => f.key === 'validity');
    assert.equal(validity?.value, '15/01/2029');
    assert.ok(validity?.hint);
  });

  it('validade sem âncora fica não determinada', async () => {
    const { buildStandardDetailsFields } = await import(
      '../src/features/document-update-version/utils/documentMetadataDisplay.ts'
    );

    const fields = buildStandardDetailsFields({
      metadata: {
        parte_reveladora: 'Só nome',
        prazo_vigencia: '5 anos',
      },
      searchMeta: { people: [], dates: [], validityDate: null },
    });

    const validity = fields.find((f) => f.key === 'validity');
    assert.equal(validity?.value, 'Não determinada');
  });
});

describe('buildVersionComparisonRows — sem duplicata de metadado', () => {
  it('casa Parte Reveladora (legado) com parte_reveladora (extração)', () => {
    const detail = {
      metadata: {
        'Parte Reveladora': 'Cristiano Rafael Baldissera',
        'Parte Receptora': 'Sidnei Alves de Almeida',
        'Data De Assinatura': '2026-06-09',
      },
      document: {
        currentFileName: 'NDA.pdf',
        categoryName: 'Jurídico',
        currentVersionLabel: 'v1.0',
        version: 1,
      },
    } as unknown as DocumentDetailResponse;

    const analysis = {
      recommendedFileName: 'NDA.pdf',
      originalFileName: 'NDA.pdf',
      classification: { className: 'Jurídico' },
      extraction: {
        metadata: {
          parte_reveladora: {
            label: 'parte reveladora',
            value: 'Cristiano Rafael Baldissera',
          },
          parte_receptora: {
            label: 'Parte receptora',
            value: 'Sidnei Alves de Almeida',
          },
          data_assinatura: {
            label: 'Data de assinatura',
            value: '2026-06-09',
          },
        },
      },
    } as unknown as AnalyzePdfResponse;

    const rows = buildVersionComparisonRows({
      detail,
      analysis,
      nextVersionLabel: 'v2.0',
    });

    const metadataRows = rows.filter((row) => row.key.startsWith('metadata:'));
    const labels = metadataRows.map((row) => row.label);

    assert.equal(labels.filter((label) => /parte reveladora/i.test(label)).length, 1);
    assert.equal(labels.filter((label) => /data de assinatura/i.test(label)).length, 1);
    assert.equal(labels.filter((label) => /parte receptora/i.test(label)).length, 1);

    const reveladora = metadataRows.find((row) => row.key === 'metadata:parte_reveladora');
    assert.ok(reveladora);
    assert.equal(reveladora.label, 'Parte reveladora');
    assert.equal(reveladora.currentValue, 'Cristiano Rafael Baldissera');
    assert.equal(reveladora.newValue, 'Cristiano Rafael Baldissera');
    assert.equal(reveladora.changed, false);
  });
});
