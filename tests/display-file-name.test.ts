import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateHeaderValue } from 'node:http';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { generateRecommendedFileName } from '../server/ai/services/documentNaming.ts';
import type { DocumentClassRule } from '../server/ai/types/documentAi.types.ts';
import { buildContentDisposition } from '../server/utils/contentDisposition.ts';
import { resolveStorageFileNames } from '../shared/storageFileName.ts';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('nome de exibição com acento, chave de storage em ASCII (Fase 10.10)', () => {
  it('o nome proposto pela IA guarda o acento, e o storage não', () => {
    const resolved = resolveStorageFileNames({
      originalFileName: 'scan.pdf',
      aiSuggestedFileName: 'ACUERDO_DE_ADQUISICIÓN_MÜLLER_2026-03-09.pdf',
      namingMode: 'ai_suggested',
      documentId: 'doc_es_001',
    });

    assert.equal(resolved.finalFileName, 'ACUERDO_DE_ADQUISICIÓN_MÜLLER_2026-03-09.pdf');
    assert.equal(resolved.storageFileName, 'ACUERDO_DE_ADQUISICION_MULLER_2026-03-09.pdf');
    assert.match(resolved.previewStorageFileName, /^[\x20-\x7e]+$/);
  });

  it('o prefixo da pasta sai do nome mesmo quando a pasta tem acento', () => {
    const juridico = {
      id: 'cat_juridico_x',
      name: 'Jurídico',
      description: '',
      keywords: [],
      namingTemplate: '{titulo}_v{version}',
      fields: [],
    } as unknown as DocumentClassRule;

    const name = generateRecommendedFileName({
      originalFileName: 'scan.pdf',
      selectedClass: juridico,
      metadata: {},
      version: 'v1.0',
      namingRoles: {
        tipo: 'Jurídico Parecer',
        sujeitos: ['Construtora Ipê Ltda'],
        dataReferencia: '2026-04-13',
      },
    });

    assert.match(name, /^PARECER_CONSTRUTORA_IPÊ/, name);
  });

  it('o cabeçalho do download aceita qualquer escrita e leva o nome em UTF-8', () => {
    const header = buildContentDisposition('attachment', 'Prestação_Łódź_合同 "x".pdf');

    assert.doesNotThrow(() => validateHeaderValue('Content-Disposition', header));
    assert.match(header, /^attachment; filename="Prestacao_/);
    assert.ok(!header.slice(0, header.indexOf('filename*')).includes('"x"'), header);
    assert.match(header, /filename\*=UTF-8''Presta%C3%A7%C3%A3o_/);
  });

  it('toda rota que serve arquivo monta o cabeçalho pelo mesmo caminho', () => {
    for (const route of [
      'api/documents/download.ts',
      'api/documents/preview.ts',
      'api/documents/preview-image.ts',
      'api/documents/preview-page.ts',
      'api/external-shares/[token]/download.ts',
      'api/sign/[token]/signed-pdf.ts',
      'api/signature-requests/[signatureRequestId]/signed-pdf.ts',
      'api/signature-requests/[signatureRequestId]/evidence.ts',
    ]) {
      const source = read(route);
      assert.match(source, /buildContentDisposition\(/, route);
      assert.ok(!/filename="\$\{/.test(source), `${route} ainda monta filename à mão`);
    }
  });
});
