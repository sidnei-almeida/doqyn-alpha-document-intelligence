export function buildUserAvatarUrl(input: {
  userId: string;
  version: number;
  size?: number;
  self?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set('v', String(input.version));
  if (input.size) params.set('size', String(input.size));
  const base = input.self
    ? '/api/profile/avatar'
    : `/api/users/${encodeURIComponent(input.userId)}/avatar`;
  return `${base}?${params.toString()}`;
}
