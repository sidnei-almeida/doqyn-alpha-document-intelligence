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

export function validateIndividualSignupForm(values: IndividualSignupFormValues): {
  valid: boolean;
  error?: string;
  field?: 'acceptedTerms';
} {
  if (!values.acceptedTerms) {
    return {
      valid: false,
      error: 'É necessário aceitar os Termos e Condições de Uso para continuar.',
      field: 'acceptedTerms',
    };
  }

  if (values.password !== values.confirmPassword) {
    return { valid: false, error: 'As senhas não conferem.' };
  }

  return { valid: true };
}

export function buildIndividualSignupPayload(values: IndividualSignupFormValues) {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    whatsapp: toE164(values.whatsapp, values.whatsappCountry ?? 'BR'),
    taxId: getIdentifierSpec(values.country, 'individual').normalize(values.taxId),
    password: values.password,
    confirmPassword: values.confirmPassword,
    acceptedTerms: true,
    acceptedTermsVersion: DOQYN_TERMS_VERSION,
  };
}

export function buildIndividualSignupReviewSections(
  values: IndividualSignupFormValues,
): ReviewSection[] {
  return [
    {
      title: 'Dados pessoais',
      fields: [
        {
          label: 'Nome completo',
          value: safeDisplayValue(`${values.firstName} ${values.lastName}`.trim()),
        },
        { label: 'E-mail', value: safeDisplayValue(values.email) },
        {
          label: 'WhatsApp',
          value: formatPhone(values.whatsapp, values.whatsappCountry ?? 'BR'),
        },
        {
          label: getIdentifierSpec(values.country, 'individual').code,
          value: formatDocumentForReview(values.taxId, values.country, 'individual'),
        },
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
      ],
    },
    {
      title: 'Segurança',
      fields: [{ label: 'Senha', value: PASSWORD_REVIEW_LABEL }],
    },
  ];
}

export const INDIVIDUAL_SIGNUP_REVIEW_COPY = {
  title: 'Revisar cadastro',
  description: 'Confira os dados antes de criar seu acesso como pessoa física no DOQYN.',
  attentionMessage:
    'Verifique principalmente CPF, e-mail e WhatsApp. Informações incorretas podem atrasar seu acesso.',
  confirmLabel: 'Confirmar e cadastrar',
} as const;
