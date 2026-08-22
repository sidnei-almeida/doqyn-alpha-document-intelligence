import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildMetadataSheetRows } from '../server/services/expiry/documentMetadataEditService.js';

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

describe('ficha de metadados carrega a forma canônica da data', () => {
  it('a linha leva `normalizedValue` junto do texto original', () => {
    const rows = buildMetadataSheetRows(
      [{ key: 'data_assinatura', label: 'Data de assinatura', type: 'date', required: true }],
      {
        // Como a extração grava de verdade: o texto do documento, com o ISO ao lado.
        data_assinatura: {
          label: 'Data de assinatura',
          value: '09 de junho de 2026',
          normalizedValue: '2026-06-09',
          confidence: 0.9,
          source: 'document_text',
        },
      },
    );

    assert.equal(rows[0].value, '09 de junho de 2026');
    assert.equal(rows[0].normalizedValue, '2026-06-09');
  });

  it('chave fora da regra também leva o canônico', () => {
    const rows = buildMetadataSheetRows([], {
      data_validade: {
        label: 'Validade',
        value: '2033-06-09',
        normalizedValue: '2033-06-09',
        confidence: 1,
        source: 'ai',
      },
    });

    assert.equal(rows[0].normalizedValue, '2033-06-09');
  });

  it('sem normalização, a linha não inventa valor', () => {
    const rows = buildMetadataSheetRows([], {
      prazo_vigencia: {
        label: 'Prazo de vigência',
        value: '7 (sete) anos',
        confidence: 0.8,
        source: 'document_text',
      },
    });

    assert.equal(rows[0].value, '7 (sete) anos');
    assert.equal(rows[0].normalizedValue, null);
  });
});

describe('editor usa o canônico no campo de data', () => {
  it('campo de data prefere `normalizedValue`', () => {
    const editor = readRepoFile('src/features/expiry/components/DocumentExpiryEditor.tsx');

    // Com o texto por extenso, o `<input type="date">` abria vazio e o dado parecia perdido.
    assert.match(editor, /toDateInputValue\(row\.normalizedValue \?\? row\.value\)/);
  });

  it('campo de texto continua mostrando o que o documento diz', () => {
    const editor = readRepoFile('src/features/expiry/components/DocumentExpiryEditor.tsx');
    assert.match(editor, /return row\.value === null \|\| row\.value === undefined \? '' : String\(row\.value\);/);
  });
});
