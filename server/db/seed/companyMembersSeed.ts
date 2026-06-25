import type { MongoCompanyMember } from '../types.js';
import { DEV_TENANT_ID } from '../constants.js';

const now = new Date();

/** Seed inicial — admin temporário e membros de exemplo para desenvolvimento. */
export const SEED_COMPANY_MEMBERS: MongoCompanyMember[] = [
  {
    _id: 'member_admin',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    userId: 'temp-admin',
    name: 'Administrador DOQYN',
    email: 'admin@doqyn.com',
    position: 'Gestão',
    role: 'admin',
    platformRoles: ['doqyn_admin', 'company_admin', 'user'],
    status: 'active',
    groupIds: ['group_juridico', 'group_diretoria'],
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'member_financeiro',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    userId: 'member_financeiro',
    name: 'Carlos Souza',
    email: 'carlos@doqyn.com',
    position: 'Analista Financeiro',
    role: 'member',
    platformRoles: ['user'],
    status: 'active',
    groupIds: ['group_financeiro'],
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'member_pending',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    userId: 'member_pending',
    name: 'Ana Oliveira',
    email: 'ana@doqyn.com',
    position: 'RH',
    role: 'member',
    platformRoles: ['user'],
    status: 'pending',
    groupIds: [],
    createdAt: now,
    updatedAt: now,
  },
];
