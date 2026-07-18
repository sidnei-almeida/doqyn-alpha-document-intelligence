import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..', 'src');

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), 'utf8');
}

const HARDCODED_PT_STRINGS = [
  "'Dados pessoais'",
  "'Nome completo'",
  "'WhatsApp'",
  "'Confirmações'",
  "'Termos de uso'",
  "'Não aceito'",
  "'Segurança'",
  "'Senha'",
  "'Revisar cadastro'",
  "'Empresa'",
  "'Administrador'",
  "'Autorização para cadastro'",
  "'É necessário aceitar os Termos e Condições de Uso para continuar.'",
  "'As senhas não conferem.'",
];

describe('signup review builders — no hardcoded pt-BR strings', () => {
  it('individualSignupReview.ts uses t() for all review/validation copy', () => {
    const source = readSrc('features/individual-signup/individualSignupReview.ts');
    for (const needle of HARDCODED_PT_STRINGS) {
      assert.equal(source.includes(needle), false, `should not contain ${needle}`);
    }
    assert.ok(source.includes("import type { TFunction } from 'i18next'"));
  });

  it('companySignupReview.ts uses t() for all review/validation copy', () => {
    const source = readSrc('features/company-signup/companySignupReview.ts');
    for (const needle of HARDCODED_PT_STRINGS) {
      assert.equal(source.includes(needle), false, `should not contain ${needle}`);
    }
    assert.ok(source.includes("import type { TFunction } from 'i18next'"));
  });

  it('PhoneInput.tsx uses t() for the incomplete-phone message and DDI label', () => {
    const source = readSrc('components/ui/PhoneInput.tsx');
    assert.equal(source.includes("'Telefone incompleto.'"), false);
    assert.equal(source.includes('label="DDI"'), false);
    assert.ok(source.includes("useTranslation('identifiers')"));
  });
});
