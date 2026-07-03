import type { ReviewSection } from '../../components/ui/ReviewBeforeSubmitDialog';
import { toTaxIdApiValue, toWhatsappApiValue } from '../../lib/identifiers';
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
  taxId: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  companyAuthorization: boolean;
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

  if (values.password !== values.confirmPassword) {
    return { valid: false, error: 'As senhas não conferem.' };
  }

  return { valid: true };
}

export function buildCompanySignupPayload(values: CompanySignupFormValues) {
  return {
    companyName: values.companyName,
    taxId: toTaxIdApiValue(values.taxId),
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    whatsapp: toWhatsappApiValue(values.whatsapp),
    password: values.password,
    confirmPassword: values.confirmPassword,
    acceptedTerms: true,
    acceptedTermsVersion: DOQYN_TERMS_VERSION,
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
        {
          label: 'CNPJ',
          value: formatDocumentForReview(values.taxId, 'CNPJ'),
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
    {
      title: 'Segurança',
      fields: [{ label: 'Senha', value: PASSWORD_REVIEW_LABEL }],
    },
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
