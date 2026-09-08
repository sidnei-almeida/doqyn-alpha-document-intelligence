import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import type { ProfileMe } from '../types';
import { parseApiError } from '@/lib/apiErrors';

export {
  validateProfileAvatarFile,
  PROFILE_AVATAR_MAX_BYTES,
  PROFILE_AVATAR_ALLOWED_TYPES,
} from '../utils/profileAvatarValidation';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await authFetch(`${API_BASE}${path}`, {
    ...options,
    credentials: options?.credentials ?? getFetchCredentials(),
    headers: withAuthHeaders(options?.headers),
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json();
}

export async function fetchProfileMe(): Promise<ProfileMe> {
  return request<ProfileMe>('/profile/me');
}

export async function uploadProfileAvatar(file: File): Promise<ProfileMe> {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await authFetch(`${API_BASE}/profile/avatar`, {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  const data = (await response.json()) as { profile: ProfileMe };
  return data.profile;
}

export async function removeProfileAvatar(): Promise<ProfileMe> {
  const data = await request<{ profile: ProfileMe }>('/profile/avatar', { method: 'DELETE' });
  return data.profile;
}
