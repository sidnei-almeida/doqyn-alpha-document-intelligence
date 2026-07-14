import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MongoVersionMetadataField } from '../server/db/types.js';
import {
  parseMetadataDate,
  projectDocumentSearchMeta,
} from '../server/services/confirm/projectSearchMeta.js';

function field(
  label: string,
  value: string | number | null,
  confidence = 0.9,
): MongoVersionMetadataField {
  return {
    label,
    value,
    normalizedValue: value,
    confidence,
    source: 'ai',
  };
}

describe('projectDocumentSearchMeta', () => {
  it('parseMetadataDate aceita ISO e dd/mm/yyyy', () => {
    const iso = parseMetadataDate('2024-03-15');
    assert.ok(iso);
    assert.equal(iso!.getUTCDate(), 15);
    assert.equal(iso!.getUTCMonth(), 2);

    const br = parseMetadataDate('15/03/2024');
    assert.ok(br);
    assert.equal(br!.getUTCDate(), 15);
    assert.equal(br!.getUTCMonth(), 2);
  });

  it('isola partes NDA com relação cruzada', () => {
    const meta = projectDocumentSearchMeta({
      parte_reveladora: field('Parte reveladora', 'Alpha Ltda'),
      parte_receptora: field('Parte receptora', 'Cristiano Rafael Baldissera'),
      data_assinatura: field('Data de assinatura', '10/01/2024'),
      cpf_cnpj_receptora: field('CPF/CNPJ', '123.456.789-00'),
    });

    assert.equal(meta.people.length, 2);
    const reveladora = meta.people.find((p) => p.role === 'parte_reveladora');
    const receptora = meta.people.find((p) => p.role === 'parte_receptora');
    assert.ok(reveladora && receptora);
    assert.equal(reveladora!.relatedTo, receptora!.name);
    assert.equal(receptora!.relatedTo, reveladora!.name);
    assert.equal(meta.dates.length, 1);
    assert.equal(meta.dates[0]!.kind, 'assinatura');
    assert.ok(!meta.people.some((p) => p.sourceKey === 'cpf_cnpj_receptora'));
  });

  it('projeta filiação (mãe/pai) ligada ao titular', () => {
    const meta = projectDocumentSearchMeta({
      nome: field('Nome', 'Cristiano Rafael Baldissera'),
      nome_mae: field('Nome da mãe', 'Maria Silva Baldissera'),
      nome_pai: field('Nome do pai', 'José Baldissera'),
      data_emissao: field('Data de emissão', '2020-05-01'),
    });

    assert.equal(meta.people.length, 3);
    const mae = meta.people.find((p) => p.role === 'mae');
    assert.ok(mae);
    assert.equal(mae!.relatedTo, 'Cristiano Rafael Baldissera');
    assert.equal(meta.people.find((p) => p.role === 'pai')?.relatedTo, 'Cristiano Rafael Baldissera');
  });

  it('extrai validade tipada de data_vencimento', () => {
    const meta = projectDocumentSearchMeta({
      beneficiario: field('Beneficiário', 'Empresa XYZ'),
      data_vencimento: field('Data de vencimento', '30/06/2026'),
    });

    assert.ok(meta.validityDate);
    assert.equal(meta.validityDate!.getUTCDate(), 30);
    assert.equal(meta.dates.some((d) => d.kind === 'vencimento'), true);
  });

  it('usa título extraído sem remover demais campos do blob', () => {
    const metadata = {
      titulo: field('Título', 'Política de Segurança da Informação'),
      area_responsavel: field('Área', 'TI'),
    };
    const meta = projectDocumentSearchMeta(metadata);
    assert.equal(meta.documentTitle, 'Política de Segurança da Informação');
    assert.equal(Object.keys(metadata).length, 2);
  });
});
