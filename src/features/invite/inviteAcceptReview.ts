import type { ReviewSection } from '../../components/ui/ReviewBeforeSubmitDialog';
import { toWhatsappApiValue } from '../../lib/identifiers';
import { DOQYN_TERMS_VERSION } from '../../legal/terms';
import {
  formatBooleanConsent,
  formatPhone,
  PASSWORD_REVIEW_LABEL,
  safeDisplayValue,
} from '../../lib/reviewDisplay';

export type AcceptInviteFormValues = {
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  whatsapp: string;
  jobTitle: string;
  departmentText: string;
  acceptedTerms: boolean;
  informationDeclaration: boolean;
  consent: boolean;
};

export type AcceptInviteReviewOptions = {
  requiresAccountCreation: boolean;
  requiresPassword: boolean;
  requiresWhatsapp: boolean;
  email: string;
  tenantDisplayName: string;
  tenantTaxIdMasked?: string;
};

function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'A senha deve ter pelo menos 8 caracteres.';
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'Senha fraca. Use letras e números com pelo menos 8 caracteres.';
  }
  return null;
}

export function validateAcceptInviteForm(
  values: AcceptInviteFormValues,
  options: AcceptInviteReviewOptions,
): {
  valid: boolean;
  error?: string;
  field?: 'acceptedTerms' | 'informationDeclaration' | 'consent';
} {
  if (!values.firstName.trim() || !values.lastName.trim()) {
    return { valid: false, error: 'Informe nome e sobrenome.' };
  }

  if (options.requiresPassword) {
    const passwordError = validatePasswordStrength(values.password);
    if (passwordError) {
      return { valid: false, error: passwordError };
    }
    if (values.password !== values.confirmPassword) {
      return { valid: false, error: 'As senhas não conferem.' };
    }
  }

  if (options.requiresWhatsapp && !values.whatsapp.trim()) {
    return { valid: false, error: 'Informe um WhatsApp válido.' };
  }

  if (!values.jobTitle.trim()) {
    return { valid: false, error: 'Informe o cargo ou função.' };
  }

  if (!values.departmentText.trim()) {
    return { valid: false, error: 'Informe o setor.' };
  }

  if (!values.acceptedTerms) {
    return {
      valid: false,
      error: 'É necessário aceitar os Termos e Condições de Uso para continuar.',
      field: 'acceptedTerms',
    };
  }

  if (!values.informationDeclaration) {
    return {
      valid: false,
      error: 'É necessário confirmar que as informações fornecidas são verdadeiras.',
      field: 'informationDeclaration',
    };
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

export function buildAcceptInvitePayload(
  values: AcceptInviteFormValues,
  options: AcceptInviteReviewOptions,
) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    ...(options.requiresPassword ? { password: values.password } : {}),
    ...(options.requiresWhatsapp ? { whatsapp: toWhatsappApiValue(values.whatsapp) } : {}),
    jobTitle: values.jobTitle.trim(),
    departmentText: values.departmentText.trim(),
    operationalNotificationsConsent: true as const,
    informationDeclaration: true as const,
    acceptedTerms: true as const,
    acceptedTermsVersion: DOQYN_TERMS_VERSION,
  };
}

export function buildAcceptInviteReviewSections(
  values: AcceptInviteFormValues,
  options: AcceptInviteReviewOptions,
): ReviewSection[] {
  return [
    {
      title: 'Empresa',
      fields: [
        { label: 'Empresa', value: safeDisplayValue(options.tenantDisplayName) },
        ...(options.tenantTaxIdMasked
          ? [{ label: 'CNPJ', value: options.tenantTaxIdMasked }]
          : []),
      ],
    },
    {
      title: 'Seus dados',
      fields: [
        { label: 'Nome', value: safeDisplayValue(values.firstName) },
        { label: 'Sobrenome', value: safeDisplayValue(values.lastName) },
        { label: 'E-mail', value: safeDisplayValue(options.email) },
        ...(options.requiresPassword
          ? [{ label: PASSWORD_REVIEW_LABEL, value: '••••••••' }]
          : []),
        ...(options.requiresWhatsapp
          ? [{ label: 'WhatsApp', value: formatPhone(values.whatsapp) }]
          : []),
        { label: 'Cargo ou função', value: safeDisplayValue(values.jobTitle) },
        { label: 'Setor informado', value: safeDisplayValue(values.departmentText) },
      ],
    },
    {
      title: 'Confirmações',
      fields: [
        { label: 'Termos de uso', value: formatBooleanConsent(values.acceptedTerms) },
        {
          label: 'Declaração de veracidade',
          value: formatBooleanConsent(values.informationDeclaration),
        },
        {
          label: 'Notificações operacionais',
          value: formatBooleanConsent(values.consent),
        },
      ],
    },
  ];
}

export const ACCEPT_INVITE_REVIEW_COPY = {
  title: 'Revisar aceite do convite',
  description: 'Confira os dados antes de concluir o cadastro e vincular seu acesso à empresa.',
  confirmLabel: 'Aceitar convite',
};
