import { authServiceJson } from '@/auth/authServiceClient';

export type TenantOutboundEmailConfig = {
  configured: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  fromDomain?: string;
  enabled?: boolean;
  lastVerifiedAt?: string | null;
  hasPassword: boolean;
};

export const tenantEmailApi = {
  get: () =>
    authServiceJson<{ ok: boolean; outboundEmail: TenantOutboundEmailConfig }>(
      '/admin/tenant/outbound-email',
    ),

  save: (input: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    enabled: boolean;
  }) =>
    authServiceJson<{ ok: boolean; outboundEmail: TenantOutboundEmailConfig }>(
      '/admin/tenant/outbound-email',
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
    ),

  test: (input?: {
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser?: string;
    smtpPassword?: string;
  }) =>
    authServiceJson<{ ok: boolean; message: string }>('/admin/tenant/outbound-email/test', {
      method: 'POST',
      body: JSON.stringify(input ?? {}),
    }),
};
