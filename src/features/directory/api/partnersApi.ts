import { authFetch } from '@/auth/apiAuth';
import { parseDocumentApiError } from '@/features/documents/api/documentsApi.errors';

export type PartnerContact = {
  userId: string;
  name: string;
  email?: string;
};

export type PartnerTenant = {
  tenantId: string;
  displayName: string;
  exchanges: number;
  lastExchangeAt: string;
  contacts: PartnerContact[];
};

export async function fetchPartnerTenants(): Promise<{
  partners: PartnerTenant[];
  total: number;
}> {
  const response = await authFetch('/api/directory/partners');
  if (!response.ok) throw await parseDocumentApiError(response);
  return response.json() as Promise<{ partners: PartnerTenant[]; total: number }>;
}
