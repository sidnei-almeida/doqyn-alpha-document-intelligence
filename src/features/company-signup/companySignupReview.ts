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
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  companyAuthorization: boolean;
  /** Ver `individualSignupReview.ts`: cadastro a partir de sessão já existente, sem senha. */
  fromAuthenticatedSession: boolean;
};

export function validateCompanySignupForm(
  values: CompanySignupFormValues,
): { valid: boolean; error?: string; field?: 'acceptedTerms' | 'companyAuthorization' } {
  if (!values.acceptedTerms) {
    return {
      valid: false,
      error: 'É necessário aceitar os Termos e Condições de Uso para continuar.',
      field: 'acceptedTerms',
    };
  }

  if (!values.companyAuthorization) {
    return {
      valid: false,
      error: 'É necessário confirmar que você possui autorização para cadastrar esta empresa.',
      field: 'companyAuthorization',
    };
  }

  if (!values.fromAuthenticatedSession && values.password !== values.confirmPassword) {
    return { valid: false, error: 'As senhas não conferem.' };
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
): ReviewSection[] {
  return [
    {
      title: 'Empresa',
      fields: [
        { label: 'Nome da empresa', value: safeDisplayValue(values.companyName) },
        { label: 'País', value: getCountryName(values.country) },
        {
          label: getTaxIdSpec(values.country, 'company').label,
          value:
            values.country === 'BR'
              ? formatDocumentForReview(values.taxId, 'CNPJ')
              : safeDisplayValue(values.taxId),
        },
      ],
    },
    {
      title: 'Administrador',
      fields: [
        {
          label: 'Nome completo',
          value: safeDisplayValue(`${values.firstName} ${values.lastName}`.trim()),
        },
        { label: 'E-mail corporativo', value: safeDisplayValue(values.email) },
        { label: 'WhatsApp', value: formatPhone(values.whatsapp) },
      ],
    },
    {
      title: 'Confirmações',
      fields: [
        {
          label: 'Termos de uso',
          value: values.acceptedTerms
            ? `Aceito em relação à versão ${DOQYN_TERMS_VERSION}`
            : 'Não aceito',
        },
        {
          label: 'Autorização para cadastro',
          value: formatBooleanConsent(
            values.companyAuthorization,
            'Possuo autorização para cadastrar esta empresa',
            'Autorização não confirmada',
          ),
        },
      ],
    },
    ...(values.fromAuthenticatedSession
      ? []
      : [
          {
            title: 'Segurança',
            fields: [{ label: 'Senha', value: PASSWORD_REVIEW_LABEL }],
          },
        ]),
  ];
}

export const COMPANY_SIGNUP_REVIEW_COPY = {
  title: 'Revisar cadastro da empresa',
  description:
    'Confira os dados antes de criar a empresa no DOQYN. Essas informações serão usadas para configurar o ambiente inicial e o acesso administrativo.',
  attentionMessage:
    'Verifique principalmente CNPJ, e-mail e WhatsApp. Informações incorretas podem atrasar a configuração do ambiente.',
  confirmLabel: 'Confirmar e cadastrar',
} as const;
