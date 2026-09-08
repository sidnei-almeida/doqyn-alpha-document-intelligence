/**
 * Dois momentos de resolver o idioma, e cada função escolhe o seu.
 *
 * `validateCompanySignupForm` roda no envio, fora de qualquer memo, e fala direto com a
 * instância. `buildCompanySignupReviewSections` roda dentro de um `useMemo` da tela e por isso
 * recebe o `t`: sem ele na lista de dependências, trocar de idioma com o diálogo aberto deixaria
 * a revisão no idioma anterior.
 */
import type { TFunction } from 'i18next';
import { i18n } from '@/i18n';
import type { ReviewSection } from '../../components/ui/ReviewBeforeSubmitDialog';
import {
  getCountryName,
  getTaxIdSpec,
  toPhoneApiValue,
  type CountryCode,
} from '../../lib/identifiers';
import { DOQYN_TERMS_VERSION } from '../../legal/terms';
import {
  formatBooleanConsent,
  formatDocumentForReview,
  formatPhone,
  PASSWORD_REVIEW_LABEL_KEY,
  safeDisplayValue,
} from '../../lib/reviewDisplay';

export type CompanySignupFormValues = {
  companyName: string;
  country: CountryCode;
  taxId: string;
  firstName: string;
  lastName: string;
  /** O handle público. Ver `UsernameField`: é por ele que outra empresa acha esta pessoa. */
  username: string;
  email: string;
  whatsapp: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  companyAuthorization: boolean;
  /** Ver `individualSignupReview.ts`: cadastro a partir de sessão já existente, sem senha. */
  fromAuthenticatedSession: boolean;
};

export function validateCompanySignupForm(values: CompanySignupFormValues): {
  valid: boolean;
  error?: string;
  field?: 'acceptedTerms' | 'companyAuthorization';
} {
  if (!values.acceptedTerms) {
    return {
      valid: false,
      error: i18n.t('auth:signupValidation.acceptTerms'),
      field: 'acceptedTerms',
    };
  }

  if (!values.companyAuthorization) {
    return {
      valid: false,
      error: i18n.t('auth:signupValidation.companyAuthorization'),
      field: 'companyAuthorization',
    };
  }

  if (!values.fromAuthenticatedSession && values.password !== values.confirmPassword) {
    return { valid: false, error: i18n.t('auth:signupValidation.passwordMismatch') };
  }

  return { valid: true };
}

export function buildCompanySignupPayload(values: CompanySignupFormValues) {
  const taxIdSpec = getTaxIdSpec(values.country, 'company');

  const base = {
    companyName: values.companyName,
    country: values.country,
    taxIdType: taxIdSpec.type,
    taxId: taxIdSpec.toApiValue(values.taxId),
    firstName: values.firstName,
    lastName: values.lastName,
    username: values.username,
    whatsapp: toPhoneApiValue(values.country, values.whatsapp),
    acceptedTerms: true as const,
    acceptedTermsVersion: DOQYN_TERMS_VERSION,
  };

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

export function buildCompanySignupReviewSections(
  values: CompanySignupFormValues,
  t: TFunction,
): ReviewSection[] {
  return [
    {
      title: t('auth:review.section.company'),
      fields: [
        { label: t('auth:review.field.companyName'), value: safeDisplayValue(values.companyName) },
        { label: t('auth:review.field.country'), value: getCountryName(values.country) },
        {
          label: t(getTaxIdSpec(values.country, 'company').labelKey),
          value:
            values.country === 'BR'
              ? formatDocumentForReview(values.taxId, 'CNPJ')
              : safeDisplayValue(values.taxId),
        },
      ],
    },
    {
      title: t('auth:review.section.administrator'),
      fields: [
        {
          label: t('auth:review.field.fullName'),
          value: safeDisplayValue(`${values.firstName} ${values.lastName}`.trim()),
        },
        { label: t('auth:review.field.username'), value: safeDisplayValue(values.username) },
        { label: t('auth:review.field.corporateEmail'), value: safeDisplayValue(values.email) },
        { label: t('auth:review.field.whatsapp'), value: formatPhone(values.whatsapp) },
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
        {
          label: t('auth:review.field.companyAuthorization'),
          value: formatBooleanConsent(
            values.companyAuthorization,
            t('auth:review.value.companyAuthorizationAccepted'),
            t('auth:review.value.companyAuthorizationRejected'),
          ),
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

export const COMPANY_SIGNUP_REVIEW_COPY_KEYS = {
  title: 'auth:companySignupReview.title',
  description: 'auth:companySignupReview.description',
  attentionMessage: 'auth:companySignupReview.attentionMessage',
  confirmLabel: 'auth:companySignupReview.confirmLabel',
} as const;
