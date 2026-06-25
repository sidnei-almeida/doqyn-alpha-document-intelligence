export {
  getTenantById,
  getTenantByTaxIdHash,
  assertActiveTenant,
  assertActiveCompany,
  ensureDevTenantSeed,
  ensureDevCompanySeed,
  listActiveTenants,
  findOrCreateTenantByTaxId,
} from './tenantsService.js';

/** @deprecated Use getTenantById */
export { getTenantById as getCompanyById } from './tenantsService.js';

/** @deprecated Use listActiveTenants */
export { listActiveTenants as listCompanies } from './tenantsService.js';
