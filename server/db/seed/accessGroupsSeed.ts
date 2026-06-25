import type { MongoAccessGroup } from '../types.js';
import { DEV_TENANT_ID } from '../constants.js';

const now = new Date();

export const SEED_ACCESS_GROUPS: MongoAccessGroup[] = [
  {
    _id: 'group_juridico',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: 'Jurídico',
    slug: 'juridico',
    color: 'blue',
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'group_financeiro',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: 'Financeiro',
    slug: 'financeiro',
    color: 'green',
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'group_rh',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: 'RH',
    slug: 'rh',
    color: 'amber',
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'group_compras',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: 'Compras',
    slug: 'compras',
    color: 'red',
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: 'group_diretoria',
    tenantId: DEV_TENANT_ID,
    companyId: DEV_TENANT_ID,
    name: 'Diretoria',
    slug: 'diretoria',
    color: 'purple',
    active: true,
    createdAt: now,
    updatedAt: now,
  },
];
