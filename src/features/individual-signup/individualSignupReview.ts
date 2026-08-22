import type { ReviewSection } from '../../components/ui/ReviewBeforeSubmitDialog';
import {
  getCountryName,
  getTaxIdSpec,
  toPhoneApiValue,
  type CountryCode,
} from '../../lib/identifiers';
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

export function validateIndividualSignupForm(
  values: IndividualSignupFormValues,
): { valid: boolean; error?: string; field?: 'acceptedTerms' } {
  if (!values.acceptedTerms) {
    return {
      valid: false,
      error: 'É necessário aceitar os Termos e Condições de Uso para continuar.',
      field: 'acceptedTerms',
    };
  }

  if (!values.fromAuthenticatedSession && values.password !== values.confirmPassword) {
    return { valid: false, error: 'As senhas não conferem.' };
  }

  return { valid: true };
}

export function buildIndividualSignupPayload(values: IndividualSignupFormValues) {
  const taxIdSpec = getTaxIdSpec(values.country, 'individual');

  const base = {
    firstName: values.firstName,
    lastName: values.lastName,
    country: values.country,
    taxIdType: taxIdSpec.type,
    whatsapp: toPhoneApiValue(values.country, values.whatsapp),
    taxId: taxIdSpec.toApiValue(values.taxId),
    acceptedTerms: true as const,
    acceptedTermsVersion: DOQYN_TERMS_VERSION,
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
        { label: 'País', value: getCountryName(values.country) },
        { label: 'WhatsApp', value: formatPhone(values.whatsapp) },
        {
          label: getTaxIdSpec(values.country, 'individual').label,
          value:
            values.country === 'BR'
              ? formatDocumentForReview(values.taxId, 'CPF')
              : safeDisplayValue(values.taxId),
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

export const INDIVIDUAL_SIGNUP_REVIEW_COPY = {
  title: 'Revisar cadastro',
  description:
    'Confira os dados antes de criar seu acesso como pessoa física no DOQYN.',
  attentionMessage:
    'Verifique principalmente CPF, e-mail e WhatsApp. Informações incorretas podem atrasar seu acesso.',
  confirmLabel: 'Confirmar e cadastrar',
} as const;
