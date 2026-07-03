import type { ReviewSection } from '../../components/ui/ReviewBeforeSubmitDialog';
import type { TaxIdKind } from '../../lib/identifiers/taxId';
import { toTaxIdApiValue, toWhatsappApiValue } from '../../lib/identifiers';
import { DOQYN_TERMS_VERSION } from '../../legal/terms';
import {
  formatBooleanConsent,
  formatDocumentForReview,
  formatPhone,
  PASSWORD_REVIEW_LABEL,
  safeDisplayValue,
} from '../../lib/reviewDisplay';
import type { PublicAccessRequestInput } from './buildAccessRequestBody';

export type RequestAccessFormValues = {
  personType: 'individual' | 'business';
  taxId: string;
  tenantDisplayName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  whatsapp: string;
  jobTitle: string;
  departmentText: string;
  reason: string;
  acceptedTerms: boolean;
  informationDeclaration: boolean;
  consent: boolean;
};

export type RequestAccessReviewOptions = {
  employeeFlow: boolean;
};

export function validateRequestAccessForm(
  values: RequestAccessFormValues,
  options: RequestAccessReviewOptions,
): { valid: boolean; error?: string; field?: 'acceptedTerms' | 'informationDeclaration' | 'consent' } {
  if (!values.acceptedTerms) {
    return {
      valid: false,
      error: 'É necessário aceitar os Termos e Condições de Uso para continuar.',
      field: 'acceptedTerms',
    };
  }

  if (options.employeeFlow && !values.informationDeclaration) {
    return {
      valid: false,
      error: 'É necessário confirmar que as informações fornecidas são verdadeiras.',
      field: 'informationDeclaration',
    };
  }

  if (options.employeeFlow && values.password !== values.confirmPassword) {
    return { valid: false, error: 'As senhas não conferem.' };
  }

  if (!values.consent) {
    return {
      valid: false,
      error: 'É necessário aceitar o consentimento de notificações operacionais.',
      field: 'consent',
    };
  }

  return { valid: true };
}

export function buildRequestAccessPayload(
  values: RequestAccessFormValues,
  options: RequestAccessReviewOptions,
): PublicAccessRequestInput {
  return {
    personType: options.employeeFlow ? 'business' : values.personType,
    taxId: toTaxIdApiValue(values.taxId),
    tenantDisplayName: options.employeeFlow ? undefined : values.tenantDisplayName || undefined,
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    password: values.password,
    whatsapp: toWhatsappApiValue(values.whatsapp),
    jobTitle: values.jobTitle,
    departmentText: values.departmentText,
    reason: values.reason,
    operationalNotificationsConsent: values.consent,
    acceptedTerms: true,
    acceptedTermsVersion: DOQYN_TERMS_VERSION,
  };
}

export function buildRequestAccessReviewSections(
  values: RequestAccessFormValues,
  options: RequestAccessReviewOptions,
): ReviewSection[] {
  const taxIdKind: TaxIdKind =
    options.employeeFlow || values.personType === 'business' ? 'CNPJ' : 'CPF';

  const sections: ReviewSection[] = [
    {
      title: options.employeeFlow ? 'Empresa' : 'Dados do cliente',
      fields: [
        ...(options.employeeFlow
          ? []
          : [
              {
                label: 'Tipo de cliente',
                value:
                  values.personType === 'business' ? 'Pessoa jurídica' : 'Pessoa física',
              },
            ]),
        {
          label: taxIdKind === 'CNPJ' ? 'CNPJ informado' : 'CPF informado',
          value: formatDocumentForReview(values.taxId, taxIdKind),
        },
        ...(!options.employeeFlow
          ? [
              {
                label: values.personType === 'business' ? 'Razão social' : 'Nome do cliente',
                value: safeDisplayValue(values.tenantDisplayName),
              },
            ]
          : []),
      ],
    },
    {
      title: 'Seus dados',
      fields: [
        {
          label: 'Nome completo',
          value: safeDisplayValue(`${values.firstName} ${values.lastName}`.trim()),
        },
        { label: 'E-mail', value: safeDisplayValue(values.email) },
        { label: 'WhatsApp', value: formatPhone(values.whatsapp) },
        { label: 'Cargo ou função', value: safeDisplayValue(values.jobTitle) },
        { label: 'Setor informado', value: safeDisplayValue(values.departmentText) },
        {
          label: 'Motivo do acesso',
          value: safeDisplayValue(values.reason),
          multiline: true,
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
        {
          label: 'Notificações operacionais',
          value: formatBooleanConsent(
            values.consent,
            'Aceito receber notificações operacionais',
            'Não aceitei notificações operacionais',
          ),
        },
        ...(options.employeeFlow
          ? [
              {
                label: 'Declaração de veracidade',
                value: formatBooleanConsent(
                  values.informationDeclaration,
                  'Informações declaradas como verdadeiras',
                  'Declaração não confirmada',
                ),
              },
            ]
          : []),
      ],
    },
    {
      title: 'Segurança',
      fields: [{ label: 'Senha', value: PASSWORD_REVIEW_LABEL }],
    },
  ];

  return sections;
}

export const REQUEST_ACCESS_REVIEW_COPY = {
  title: 'Revisar solicitação',
  description:
    'Confira se todas as informações estão corretas. Depois do envio, o administrador da empresa usará esses dados para aprovar ou rejeitar seu acesso.',
  attentionMessage:
    'Verifique principalmente CNPJ, e-mail e WhatsApp. Informações incorretas podem atrasar a aprovação do acesso.',
  confirmLabel: 'Confirmar e enviar',
} as const;
