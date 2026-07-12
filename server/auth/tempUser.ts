import { DEV_TENANT_ID } from '../db/constants.js';
import type { AuthRole, AuthUser } from './types.js';

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getTemporaryUser(): AuthUser {
  const email = requiredEnv('TEMP_ADMIN_EMAIL').toLowerCase().trim();

  const role = (process.env.TEMP_USER_ROLE || 'admin') as AuthRole;

  const groups = (process.env.TEMP_USER_GROUPS || 'admin')
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean);

  return {
    id: 'temp-admin',
    email,
    name: process.env.TEMP_ADMIN_NAME || 'Administrador DOQYN',

    companyId: process.env.TEMP_COMPANY_ID?.trim() || DEV_TENANT_ID,
    tenantId: process.env.TEMP_COMPANY_ID?.trim() || DEV_TENANT_ID,
    companyName: process.env.TEMP_COMPANY_NAME || 'DOQYN Alpha',

    role,
    area: process.env.TEMP_USER_AREA || 'Gestão',
    groups,
  };
}

export function isTemporaryAuthEnabled(): boolean {
  return process.env.TEMP_AUTH_ENABLED !== 'false';
}
