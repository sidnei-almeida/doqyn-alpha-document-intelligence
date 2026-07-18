import type { TFunction } from 'i18next';
import type { ReviewSection } from '../../components/ui/ReviewBeforeSubmitDialog';
import { getIdentifierSpec, toE164, type CountryCode } from '../../lib/identifiers';
import { DOQYN_TERMS_VERSION } from '../../legal/terms';
import {
  formatBooleanConsent,
  formatDocumentForReview,
  formatPhone,
  PASSWORD_REVIEW_LABEL,
  safeDisplayValue,
} from '../../lib/reviewDisplay';

export type CompanySignupFormValues = {
  companyName: string;
  country: CountryCode;
  taxId: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  whatsappCountry?: CountryCode;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  companyAuthorization: boolean;
};

export function validateCompanySignupForm(
  values: CompanySignupFormValues,
  t: TFunction<'auth'>,
): {
  valid: boolean;
  error?: string;
  field?: 'acceptedTerms' | 'companyAuthorization';
} {
  if (!values.acceptedTerms) {
    return {
      valid: false,
      error: t('signup.common.acceptTermsRequired'),
      field: 'acceptedTerms',
    };
  }

  if (!values.companyAuthorization) {
    return {
      valid: false,
      error: t('signup.common.companyAuthorizationRequired'),
      field: 'companyAuthorization',
    };
  }

  if (values.password !== values.confirmPassword) {
    return { valid: false, error: t('signup.common.passwordMismatch') };
  }

  return { valid: true };
}

export function buildCompanySignupPayload(values: CompanySignupFormValues) {
  return {
    companyName: values.companyName,
    taxId: getIdentifierSpec(values.country, 'company').normalize(values.taxId),
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    whatsapp: toE164(values.whatsapp, values.whatsappCountry ?? 'BR'),
    password: values.password,
    confirmPassword: values.confirmPassword,
    acceptedTerms: true,
    acceptedTermsVersion: DOQYN_TERMS_VERSION,
  };
}

export function buildCompanySignupReviewSections(
  values: CompanySignupFormValues,
  t: TFunction<'auth'>,
): ReviewSection[] {
  return [
    {
      title: t('signup.company.review.companySectionTitle'),
      fields: [
        {
          label: t('signup.company.review.companyNameLabel'),
          value: safeDisplayValue(values.companyName),
        },
        {
          label: getIdentifierSpec(values.country, 'company').code,
          value: formatDocumentForReview(values.taxId, values.country, 'company'),
        },
      ],
    },
    {
      title: t('signup.company.review.adminSectionTitle'),
      fields: [
        {
          label: t('signup.common.review.fullNameLabel'),
          value: safeDisplayValue(`${values.firstName} ${values.lastName}`.trim()),
        },
        { label: t('signup.company.review.emailLabel'), value: safeDisplayValue(values.email) },
        {
          label: t('signup.company.review.whatsappLabel'),
          value: formatPhone(values.whatsapp, values.whatsappCountry ?? 'BR'),
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
        {
          label: t('signup.company.review.authorizationLabel'),
          value: formatBooleanConsent(
            values.companyAuthorization,
            t('signup.company.review.authorizationGranted'),
            t('signup.company.review.authorizationNotGranted'),
          ),
        },
      ],
    },
    {
      title: t('signup.common.review.securityTitle'),
      fields: [{ label: t('signup.common.review.passwordLabel'), value: PASSWORD_REVIEW_LABEL }],
    },
  ];
}

export function getCompanySignupReviewCopy(t: TFunction<'auth'>) {
  return {
    title: t('signup.company.review.title'),
    description: t('signup.company.review.description'),
    attentionMessage: t('signup.company.review.attentionMessage'),
    confirmLabel: t('signup.company.review.confirmLabel'),
  } as const;
}
