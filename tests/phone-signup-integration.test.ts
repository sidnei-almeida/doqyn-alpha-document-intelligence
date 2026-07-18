import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import i18n from '../src/i18n/index.ts';
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

const t = i18n.getFixedT('pt-BR', 'auth');

const individualBaseForm: IndividualSignupFormValues = {
  firstName: 'Ana',
  lastName: 'Lima',
  email: 'ana@email.com',
  whatsapp: '+55 54 99999-9999',
  whatsappCountry: 'BR',
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
  whatsapp: '+55 54 99999-9999',
  whatsappCountry: 'BR',
  password: 'senha-segura-123',
  confirmPassword: 'senha-segura-123',
  acceptedTerms: true,
  companyAuthorization: true,
};

function whatsappReviewValue(sections: ReturnType<typeof buildIndividualSignupReviewSections>) {
  return sections.flatMap((section) => section.fields).find((f) => f.label === 'WhatsApp')?.value;
}

describe('individual signup phone (BR/PY/US)', () => {
  it('BR regression: payload whatsapp is byte-identical to today (5554999999999)', () => {
    const payload = buildIndividualSignupPayload(individualBaseForm);
    assert.equal(payload.whatsapp, '5554999999999');
  });

  it('BR review field formats as +55 54 99999 9999', () => {
    const sections = buildIndividualSignupReviewSections(individualBaseForm, t);
    assert.equal(whatsappReviewValue(sections), '+55 54 99999 9999');
  });

  it('PY payload whatsapp is 595981234567 and review is +595 981 234567', () => {
    const values: IndividualSignupFormValues = {
      ...individualBaseForm,
      whatsapp: '+595 981 234 567',
      whatsappCountry: 'PY',
    };
    const payload = buildIndividualSignupPayload(values);
    assert.equal(payload.whatsapp, '595981234567');

    const sections = buildIndividualSignupReviewSections(values, t);
    assert.equal(whatsappReviewValue(sections), '+595 981 234567');
  });

  it('US payload whatsapp is 12025550123 and review is +1 202 555 0123', () => {
    const values: IndividualSignupFormValues = {
      ...individualBaseForm,
      whatsapp: '+1 (202) 555-0123',
      whatsappCountry: 'US',
    };
    const payload = buildIndividualSignupPayload(values);
    assert.equal(payload.whatsapp, '12025550123');

    const sections = buildIndividualSignupReviewSections(values, t);
    assert.equal(whatsappReviewValue(sections), '+1 202 555 0123');
  });

  it('defaults to BR payload when whatsappCountry is omitted (keeps country-signup-integration.test.ts fixtures valid)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure-to-omit pattern
    const { whatsappCountry: _omit, ...withoutCountry } = individualBaseForm;
    const payload = buildIndividualSignupPayload(withoutCountry as IndividualSignupFormValues);
    assert.equal(payload.whatsapp, '5554999999999');
  });
});

describe('company signup phone (BR/PY/US)', () => {
  it('BR regression: payload whatsapp is byte-identical to today (5554999999999)', () => {
    const payload = buildCompanySignupPayload(companyBaseForm);
    assert.equal(payload.whatsapp, '5554999999999');
  });

  it('BR review field formats as +55 54 99999 9999', () => {
    const sections = buildCompanySignupReviewSections(companyBaseForm, t);
    assert.equal(whatsappReviewValue(sections), '+55 54 99999 9999');
  });

  it('PY payload whatsapp is 595981234567 and review is +595 981 234567', () => {
    const values: CompanySignupFormValues = {
      ...companyBaseForm,
      whatsapp: '+595 981 234 567',
      whatsappCountry: 'PY',
    };
    const payload = buildCompanySignupPayload(values);
    assert.equal(payload.whatsapp, '595981234567');

    const sections = buildCompanySignupReviewSections(values, t);
    assert.equal(whatsappReviewValue(sections), '+595 981 234567');
  });

  it('US payload whatsapp is 12025550123 and review is +1 202 555 0123', () => {
    const values: CompanySignupFormValues = {
      ...companyBaseForm,
      whatsapp: '+1 (202) 555-0123',
      whatsappCountry: 'US',
    };
    const payload = buildCompanySignupPayload(values);
    assert.equal(payload.whatsapp, '12025550123');

    const sections = buildCompanySignupReviewSections(values, t);
    assert.equal(whatsappReviewValue(sections), '+1 202 555 0123');
  });

  it('defaults to BR payload when whatsappCountry is omitted (keeps country-signup-integration.test.ts fixtures valid)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure-to-omit pattern
    const { whatsappCountry: _omit, ...withoutCountry } = companyBaseForm;
    const payload = buildCompanySignupPayload(withoutCountry as CompanySignupFormValues);
    assert.equal(payload.whatsapp, '5554999999999');
  });
});
