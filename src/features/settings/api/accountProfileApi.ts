import { authServiceJson } from '@/auth/authServiceClient';

export type AccountProfileUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export const accountProfileApi = {
  update: (input: { firstName: string; lastName: string }) =>
    authServiceJson<{ ok: boolean; user: AccountProfileUser }>('/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
};
