export type PublicAccessRequestInput = {
  personType: 'individual' | 'business';
  taxId: string;
  tenantDisplayName?: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  password?: string;
  jobTitle: string;
  departmentText: string;
  reason: string;
  operationalNotificationsConsent: boolean;
  acceptedTerms: boolean;
  acceptedTermsVersion: string;
};

export function buildPublicAccessRequestBody(
  input: PublicAccessRequestInput,
  authMode: 'doqyn_auth' | 'legacy',
) {
  if (authMode === 'doqyn_auth') {
    return {
      personType: input.personType,
      taxId: input.taxId,
      tenantDisplayName: input.tenantDisplayName,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      whatsapp: input.whatsapp,
      password: input.password ?? '',
      jobTitle: input.jobTitle,
      departmentText: input.departmentText,
      reason: input.reason,
      operationalNotificationsConsent: input.operationalNotificationsConsent,
      acceptedTerms: input.acceptedTerms,
      acceptedTermsVersion: input.acceptedTermsVersion,
    };
  }

  return input;
}
