/** Ver `companySignupReview.ts`: validação resolve no envio, revisão recebe o `t` do memo. */
import type { TFunction } from 'i18next';
import { i18n } from '@/i18n';
import type { ReviewSection } from '../../components/ui/ReviewBeforeSubmitDialog';
import {
  getCountryName,
  getTaxIdSpec,
  toPhoneApiValue,
  type CountryCode,
} from '../../lib/identifiers';
import { acceptedTermsLocale, DOQYN_TERMS_VERSION } from '../../legal/terms';
import {
  formatDocumentForReview,
  formatPhone,
  PASSWORD_REVIEW_LABEL_KEY,
  safeDisplayValue,
} from '../../lib/reviewDisplay';

export type IndividualSignupFormValues = {
  firstName: string;
  lastName: string;
  /** O handle público. Ver `UsernameField`: é por ele que outra empresa acha esta pessoa. */
  username: string;
  email: string;
  country: CountryCode;
  whatsapp: string;
  taxId: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  /**
   * Cadastro a partir de uma sessão que já existe (entrou por Google e ainda não tem
   * espaço de trabalho). Nesse caso não há senha: a conta é acessada pelo provedor.
   */
  fromAuthenticatedSession: boolean;
};

export function validateIndividualSignupForm(values: IndividualSignupFormValues): {
  valid: boolean;
  error?: string;
  field?: 'acceptedTerms';
} {
  if (!values.acceptedTerms) {
    return {
      valid: false,
      error: i18n.t('auth:signupValidation.acceptTerms'),
      field: 'acceptedTerms',
    };
  }

  if (!values.fromAuthenticatedSession && values.password !== values.confirmPassword) {
    return { valid: false, error: i18n.t('auth:signupValidation.passwordMismatch') };
  }

  const taxIdSpec = getTaxIdSpec(values.country, 'individual');
  if (!taxIdSpec.isValid(values.taxId)) {
    return {
      valid: false,
      error: i18n.t('common:taxId.invalid', { label: i18n.t(taxIdSpec.labelKey) }),
    };
  }

  return { valid: true };
}

export function buildIndividualSignupPayload(values: IndividualSignupFormValues) {
  const taxIdSpec = getTaxIdSpec(values.country, 'individual');

  const base = {
    firstName: values.firstName,
    lastName: values.lastName,
    username: values.username,
    country: values.country,
    taxIdType: taxIdSpec.type,
    whatsapp: toPhoneApiValue(values.country, values.whatsapp),
    taxId: taxIdSpec.toApiValue(values.taxId),
    acceptedTerms: true as const,
    acceptedTermsVersion: DOQYN_TERMS_VERSION,
    acceptedTermsLocale: acceptedTermsLocale(),
  };

  // Com sessão, o servidor tira identidade e senha da própria sessão — mandar e-mail aqui
  // seria oferecer uma identidade que ninguém verificou.
  if (values.fromAuthenticatedSession) {
    return base;
  }

  return {
    ...base,
    email: values.email,
    password: values.password,
    confirmPassword: values.confirmPassword,
  };
}

export function buildIndividualSignupReviewSections(
  values: IndividualSignupFormValues,
  t: TFunction,
): ReviewSection[] {
  return [
    {
      title: t('auth:review.section.personalData'),
      fields: [
        {
          label: t('auth:review.field.fullName'),
          value: safeDisplayValue(`${values.firstName} ${values.lastName}`.trim()),
        },
        { label: t('auth:review.field.username'), value: safeDisplayValue(values.username) },
        { label: t('auth:review.field.email'), value: safeDisplayValue(values.email) },
        { label: t('auth:review.field.country'), value: getCountryName(values.country) },
        { label: t('auth:review.field.whatsapp'), value: formatPhone(values.whatsapp) },
        {
          label: t(getTaxIdSpec(values.country, 'individual').labelKey),
          value:
            values.country === 'BR'
              ? formatDocumentForReview(values.taxId, 'CPF')
              : safeDisplayValue(values.taxId),
        },
      ],
    },
    {
      title: t('auth:review.section.confirmations'),
      fields: [
        {
          label: t('auth:review.field.terms'),
          value: values.acceptedTerms
            ? t('auth:review.value.termsAcceptedVersion', { version: DOQYN_TERMS_VERSION })
            : t('auth:review.value.termsRejected'),
        },
      ],
    },
    ...(values.fromAuthenticatedSession
      ? []
      : [
          {
            title: t('auth:review.section.security'),
            fields: [
              { label: t('auth:review.field.password'), value: t(PASSWORD_REVIEW_LABEL_KEY) },
            ],
          },
        ]),
  ];
}

export const INDIVIDUAL_SIGNUP_REVIEW_COPY_KEYS = {
  title: 'auth:individualSignupReview.title',
  description: 'auth:individualSignupReview.description',
  attentionMessage: 'auth:individualSignupReview.attentionMessage',
  confirmLabel: 'auth:individualSignupReview.confirmLabel',
} as const;
