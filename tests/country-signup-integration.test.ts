import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  buildIndividualSignupPayload,
  buildIndividualSignupReviewSections,
  type IndividualSignupFormValues,
} from '../src/features/individual-signup/individualSignupReview';
import {
  buildCompanySignupPayload,
  buildCompanySignupReviewSections,
  type CompanySignupFormValues,
} from '../src/features/company-signup/companySignupReview';
import { DOQYN_TERMS_VERSION } from '../src/legal/terms';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const individualBaseForm: IndividualSignupFormValues = {
  firstName: 'Ana',
  lastName: 'Lima',
  email: 'ana@email.com',
  whatsapp: '+55 (11) 97777-6666',
  country: 'BR',
  taxId: '',
  password: 'senha-segura-123',
  confirmPassword: 'senha-segura-123',
  acceptedTerms: true,
};

const companyBaseForm: CompanySignupFormValues = {
  companyName: 'Alpha Consultoria',
  country: 'BR',
  taxId: '',
  firstName: 'Maria',
  lastName: 'Santos',
  email: 'maria@alpha.com',
  whatsapp: '+55 (11) 98888-7777',
  password: 'senha-segura-123',
  confirmPassword: 'senha-segura-123',
  acceptedTerms: true,
  companyAuthorization: true,
};

function readSource(relativePath: string): string {
  return readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('individual signup', () => {
  it('normalizes the taxId payload to digits for US (SSN)', () => {
    const payload = buildIndividualSignupPayload({
      ...individualBaseForm,
      country: 'US',
      taxId: '123-45-6789',
    });
    assert.equal(payload.taxId, '123456789');
  });

  it('normalizes the taxId payload to digits for PY (CI)', () => {
    const payload = buildIndividualSignupPayload({
      ...individualBaseForm,
      country: 'PY',
      taxId: '1.234.567',
    });
    assert.equal(payload.taxId, '1234567');
  });

  it('payload keeps acceptedTerms/version regardless of country', () => {
    const payload = buildIndividualSignupPayload({
      ...individualBaseForm,
      country: 'US',
      taxId: '123-45-6789',
    });
    assert.equal(payload.acceptedTerms, true);
    assert.equal(payload.acceptedTermsVersion, DOQYN_TERMS_VERSION);
  });

  it('masks the review value for US (SSN)', () => {
    const sections = buildIndividualSignupReviewSections({
      ...individualBaseForm,
      country: 'US',
      taxId: '123-45-6789',
    });
    const field = sections.flatMap((section) => section.fields).find((f) => f.label === 'SSN');
    assert.equal(field?.value, '***-**-6789');
  });

  it('masks the review value for BR (CPF)', () => {
    const sections = buildIndividualSignupReviewSections({
      ...individualBaseForm,
      country: 'BR',
      taxId: '529.982.247-25',
    });
    const field = sections.flatMap((section) => section.fields).find((f) => f.label === 'CPF');
    assert.equal(field?.value, '529.***.***-25');
  });

  it('IndividualSignupPage wires country selection and DocumentIdInput', () => {
    const source = readSource('src/features/individual-signup/IndividualSignupPage.tsx');
    assert.match(source, /DocumentIdInput/);
    assert.match(source, /CountrySelect/);
    assert.match(source, /defaultCountryForLocale/);
    assert.doesNotMatch(source, /TaxIdInput/);
  });
});

describe('company signup', () => {
  it('normalizes the taxId payload to digits for US (EIN)', () => {
    const payload = buildCompanySignupPayload({
      ...companyBaseForm,
      country: 'US',
      taxId: '12-3456789',
    });
    assert.equal(payload.taxId, '123456789');
  });

  it('normalizes the taxId payload to digits for PY (RUC)', () => {
    const payload = buildCompanySignupPayload({
      ...companyBaseForm,
      country: 'PY',
      taxId: '80017726-6',
    });
    assert.equal(payload.taxId, '800177266');
  });

  it('renders the review value in full (unmasked) for US (EIN)', () => {
    const sections = buildCompanySignupReviewSections({
      ...companyBaseForm,
      country: 'US',
      taxId: '123456789',
    });
    const field = sections.flatMap((section) => section.fields).find((f) => f.label === 'EIN');
    assert.equal(field?.value, '12-3456789');
  });

  it('renders the review value in full (unmasked) for PY (RUC)', () => {
    const sections = buildCompanySignupReviewSections({
      ...companyBaseForm,
      country: 'PY',
      taxId: '800177266',
    });
    const field = sections.flatMap((section) => section.fields).find((f) => f.label === 'RUC');
    assert.equal(field?.value, '80017726-6');
  });

  it('renders the review value in full for BR (CNPJ)', () => {
    const sections = buildCompanySignupReviewSections({
      ...companyBaseForm,
      country: 'BR',
      taxId: '11222333000181',
    });
    const field = sections.flatMap((section) => section.fields).find((f) => f.label === 'CNPJ');
    assert.equal(field?.value, '11.222.333/0001-81');
  });

  it('CompanySignupPage wires country selection and DocumentIdInput', () => {
    const source = readSource('src/features/company-signup/CompanySignupPage.tsx');
    assert.match(source, /DocumentIdInput/);
    assert.match(source, /CountrySelect/);
    assert.match(source, /defaultCountryForLocale/);
    assert.doesNotMatch(source, /TaxIdInput/);
  });
});
