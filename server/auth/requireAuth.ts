import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionFromRequest } from './session';

export async function requireAuth(req: VercelRequest, res: VercelResponse) {
  const user = await getSessionFromRequest(req);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  return user;
}

export function userHasGroup(user: { groups: string[] }, group: string) {
  return user.groups.includes(group);
}

export function userHasAnyGroup(user: { groups: string[] }, groups: string[]) {
  return groups.some((group) => user.groups.includes(group));
}

export function userHasRole(user: { role: string }, roles: string[]) {
  return roles.includes(user.role);
}
