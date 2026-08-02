import type { TFunction } from 'i18next';
import type { ReviewSection } from '../../components/ui/ReviewBeforeSubmitDialog';
import { getIdentifierSpec, toE164, type CountryCode } from '../../lib/identifiers';
import { DOQYN_TERMS_VERSION } from '../../legal/terms';
import {
  formatDocumentForReview,
  formatPhone,
  PASSWORD_REVIEW_LABEL,
  safeDisplayValue,
} from '../../lib/reviewDisplay';

export type IndividualSignupFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  whatsappCountry?: CountryCode;
  country: CountryCode;
  taxId: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};

export function validateIndividualSignupForm(
  values: IndividualSignupFormValues,
  t: TFunction<'auth'>,
): {
  valid: boolean;
  error?: string;
  field?: 'acceptedTerms' | 'taxId';
} {
  if (!values.acceptedTerms) {
    return {
      valid: false,
      error: t('signup.common.acceptTermsRequired'),
      field: 'acceptedTerms',
    };
  }

  if (values.password !== values.confirmPassword) {
    return { valid: false, error: t('signup.common.passwordMismatch') };
  }

  if (!getIdentifierSpec(values.country, 'individual').validate(values.taxId)) {
    return { valid: false, error: t('signup.common.invalidTaxId'), field: 'taxId' };
  }

  return { valid: true };
}

export function buildIndividualSignupPayload(values: IndividualSignupFormValues) {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    whatsapp: toE164(values.whatsapp, values.whatsappCountry ?? 'BR'),
    country: values.country,
    taxIdType: getIdentifierSpec(values.country, 'individual').code.toLowerCase(),
    taxId: getIdentifierSpec(values.country, 'individual').normalize(values.taxId),
    password: values.password,
    confirmPassword: values.confirmPassword,
    acceptedTerms: true,
    acceptedTermsVersion: DOQYN_TERMS_VERSION,
  };
}

export function buildIndividualSignupReviewSections(
  values: IndividualSignupFormValues,
  t: TFunction<'auth'>,
): ReviewSection[] {
  return [
    {
      title: t('signup.individual.review.sectionTitle'),
      fields: [
        {
          label: t('signup.common.review.fullNameLabel'),
          value: safeDisplayValue(`${values.firstName} ${values.lastName}`.trim()),
        },
        { label: t('signup.individual.review.emailLabel'), value: safeDisplayValue(values.email) },
        {
          label: t('signup.individual.review.whatsappLabel'),
          value: formatPhone(values.whatsapp, values.whatsappCountry ?? 'BR'),
        },
        {
          label: getIdentifierSpec(values.country, 'individual').code,
          value: formatDocumentForReview(values.taxId, values.country, 'individual'),
        },
      ],
    },
    {
      title: t('signup.common.review.confirmationsTitle'),
      fields: [
        {
          label: t('signup.common.review.termsLabel'),
          value: values.acceptedTerms
            ? t('signup.common.review.termsAccepted', { version: DOQYN_TERMS_VERSION })
            : t('signup.common.review.termsNotAccepted'),
        },
      ],
    },
    {
      title: t('signup.common.review.securityTitle'),
      fields: [{ label: t('signup.common.review.passwordLabel'), value: PASSWORD_REVIEW_LABEL }],
    },
  ];
}

export function getIndividualSignupReviewCopy(t: TFunction<'auth'>) {
  return {
    title: t('signup.individual.review.title'),
    description: t('signup.individual.review.description'),
    attentionMessage: t('signup.individual.review.attentionMessage'),
    confirmLabel: t('signup.individual.review.confirmLabel'),
  } as const;
}
