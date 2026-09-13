/** Ver `companySignupReview.ts`: validação resolve no envio, revisão recebe o `t` do memo. */
import type { TFunction } from 'i18next';
import { i18n } from '@/i18n';
import type { ReviewSection } from '../../components/ui/ReviewBeforeSubmitDialog';
import { toWhatsappApiValue } from '../../lib/identifiers';
import { acceptedTermsLocale, DOQYN_TERMS_VERSION } from '../../legal/terms';
import {
  formatBooleanConsent,
  formatPhone,
  PASSWORD_REVIEW_LABEL_KEY,
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
    return i18n.t('auth:signupValidation.passwordTooShort');
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return i18n.t('auth:signupValidation.passwordWeak');
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
    return { valid: false, error: i18n.t('auth:signupValidation.nameRequired') };
  }

  if (options.requiresPassword) {
    const passwordError = validatePasswordStrength(values.password);
    if (passwordError) {
      return { valid: false, error: passwordError };
    }
    if (values.password !== values.confirmPassword) {
      return { valid: false, error: i18n.t('auth:signupValidation.passwordMismatch') };
    }
  }

  if (options.requiresWhatsapp && !values.whatsapp.trim()) {
    return { valid: false, error: i18n.t('auth:signupValidation.whatsappRequired') };
  }

  if (!values.jobTitle.trim()) {
    return { valid: false, error: i18n.t('auth:signupValidation.jobTitleRequired') };
  }

  if (!values.departmentText.trim()) {
    return { valid: false, error: i18n.t('auth:signupValidation.departmentRequired') };
  }

  if (!values.acceptedTerms) {
    return {
      valid: false,
      error: i18n.t('auth:signupValidation.acceptTerms'),
      field: 'acceptedTerms',
    };
  }

  if (!values.informationDeclaration) {
    return {
      valid: false,
      error: i18n.t('auth:signupValidation.informationDeclaration'),
      field: 'informationDeclaration',
    };
  }

  if (!values.consent) {
    return {
      valid: false,
      error: i18n.t('auth:signupValidation.notificationsConsent'),
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
    acceptedTermsLocale: acceptedTermsLocale(),
  };
}

export function buildAcceptInviteReviewSections(
  values: AcceptInviteFormValues,
  options: AcceptInviteReviewOptions,
  t: TFunction,
): ReviewSection[] {
  return [
    {
      title: t('auth:review.section.company'),
      fields: [
        {
          label: t('auth:review.field.company'),
          value: safeDisplayValue(options.tenantDisplayName),
        },
        ...(options.tenantTaxIdMasked
          ? [{ label: t('auth:review.field.taxIdCnpj'), value: options.tenantTaxIdMasked }]
          : []),
      ],
    },
    {
      title: t('auth:review.section.yourData'),
      fields: [
        { label: t('auth:review.field.firstName'), value: safeDisplayValue(values.firstName) },
        { label: t('auth:review.field.lastName'), value: safeDisplayValue(values.lastName) },
        { label: t('auth:review.field.email'), value: safeDisplayValue(options.email) },
        ...(options.requiresPassword
          ? [{ label: t(PASSWORD_REVIEW_LABEL_KEY), value: '••••••••' }]
          : []),
        ...(options.requiresWhatsapp
          ? [{ label: t('auth:review.field.whatsapp'), value: formatPhone(values.whatsapp) }]
          : []),
        { label: t('auth:review.field.jobTitle'), value: safeDisplayValue(values.jobTitle) },
        {
          label: t('auth:review.field.department'),
          value: safeDisplayValue(values.departmentText),
        },
      ],
    },
    {
      title: t('auth:review.section.confirmations'),
      fields: [
        {
          label: t('auth:review.field.terms'),
          value: formatBooleanConsent(
            values.acceptedTerms,
            t('auth:review.value.termsAccepted'),
            t('auth:review.value.termsRejected'),
          ),
        },
        {
          label: t('auth:review.field.informationDeclaration'),
          value: formatBooleanConsent(
            values.informationDeclaration,
            t('auth:review.value.informationDeclarationAccepted'),
            t('auth:review.value.informationDeclarationRejected'),
          ),
        },
        {
          label: t('auth:review.field.operationalNotifications'),
          value: formatBooleanConsent(
            values.consent,
            t('auth:review.value.operationalNotificationsAccepted'),
            t('auth:review.value.operationalNotificationsRejected'),
          ),
        },
      ],
    },
  ];
}

export const ACCEPT_INVITE_REVIEW_COPY_KEYS = {
  title: 'auth:acceptInviteReview.title',
  description: 'auth:acceptInviteReview.description',
  confirmLabel: 'auth:acceptInviteReview.confirmLabel',
} as const;
