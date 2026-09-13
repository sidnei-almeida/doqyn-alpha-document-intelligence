import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectDocumentLanguage } from '../server/ai/utils/detectDocumentLanguage.ts';

const PT = `Pelo presente instrumento particular de prestação de serviços, de um lado FRIGORÍFICO CERRO
AZUL S.A., inscrita no CNPJ sob o nº 61.207.443/0001-19, com sede na BR-153, km 402, neste ato
representada por seu Gerente de Suprimentos, doravante denominada CONTRATANTE; e, de outro lado,
TALHA SUL SERVIÇOS INDUSTRIAIS LTDA., com sede na Rua Duque de Caxias, doravante denominada
CONTRATADA. As partes não poderão ceder este contrato sem a anuência da outra, e o prazo de
vigência será de 12 meses contados da assinatura, podendo ser renovado pelas partes.`;

const EN = `THIS MASTER SERVICES AGREEMENT is entered into on March 4, 2026, by and between Northwind
Logistics Inc., a Delaware corporation (the "Customer"), and Bluepeak Analytics LLC (the
"Supplier"). The Supplier shall provide the services described in Schedule A, and any change to
the scope shall be agreed in writing by both parties. This Agreement will remain in force for a
term of thirty-six (36) months from the Effective Date and is governed by the laws of New York.`;

const ES = `En la Ciudad de México, a los quince días del mes de marzo de 2026, comparecen por una parte
COMERCIALIZADORA DEL BAJÍO, S.A. DE C.V., en lo sucesivo la PARTE REVELADORA, y por la otra
SERVICIOS TÉCNICOS ANDINOS, S.L., en lo sucesivo la PARTE RECEPTORA. Las partes acuerdan que toda
información confidencial será tratada con el mismo cuidado que su propia información, y que el
presente convenio tendrá una vigencia de tres (3) años contados a partir de su firma.`;

describe('detecção de idioma do documento', () => {
  it('reconhece português, inglês e espanhol', () => {
    assert.equal(detectDocumentLanguage(PT), 'pt');
    assert.equal(detectDocumentLanguage(EN), 'en');
    assert.equal(detectDocumentLanguage(ES), 'es');
  });

  it('texto curto demais não decide', () => {
    assert.equal(detectDocumentLanguage('ATESTADO MÉDICO. Repouso de 3 dias.'), 'und');
    assert.equal(detectDocumentLanguage(''), 'und');
  });

  it('é determinístico e só olha o começo', () => {
    // O começo inteiro em português, o resto em inglês: só a amostra do começo decide.
    const long = `${PT.repeat(8)}\n${EN.repeat(20)}`;
    assert.equal(detectDocumentLanguage(long), detectDocumentLanguage(long));
    assert.equal(detectDocumentLanguage(long), 'pt');
  });

  it('texto em caixa alta e acentuado não confunde', () => {
    assert.equal(detectDocumentLanguage(PT.toUpperCase()), 'pt');
    assert.equal(detectDocumentLanguage(ES.toUpperCase()), 'es');
  });
});
