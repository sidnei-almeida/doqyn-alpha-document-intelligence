import type {
  MongoDocumentAccessPermissions,
  MongoDocumentAccessRule,
  MongoDocumentCategory,
  MongoDocumentExtractionRule,
  MongoDocumentGroup,
} from '../../server/db/types.js';
import { buildClassRuleOwnershipFilter } from '../../server/tenancy/documentOwnership.js';
import { resolveTenantStorageContextFromIds } from '../../server/tenancy/tenantStorage.js';
import {
  SEED_GOVERNANCE_ACCESS_RULES,
  SEED_GOVERNANCE_CATEGORIES,
  SEED_GOVERNANCE_EXTRACTION_RULES,
  SEED_GOVERNANCE_GROUPS,
} from '../../server/db/seed/documentGovernanceSeed.js';

export function applyBusinessGovernanceOwnership<T extends Record<string, unknown>>(
  row: T,
  tenantId: string,
): T & {
  tenantId: string;
  companyId: string;
  tenantType: 'business';
  ownerTenantId: string;
} {
  return {
    ...row,
    tenantId,
    companyId: tenantId,
    tenantType: 'business',
    ownerTenantId: tenantId,
  };
}

function remapTenantGovernance<T extends { tenantId: string; companyId: string }>(
  rows: T[],
  tenantId: string,
) {
  return rows.map((row) => applyBusinessGovernanceOwnership(row, tenantId));
}

export type TenantGovernanceSeed = {
  categories: MongoDocumentCategory[];
  groups: MongoDocumentGroup[];
  accessRules: MongoDocumentAccessRule[];
  extractionRules: MongoDocumentExtractionRule[];
};

export function buildGovernanceSeedForTenant(tenantId: string): TenantGovernanceSeed {
  return {
    categories: remapTenantGovernance(SEED_GOVERNANCE_CATEGORIES, tenantId),
    groups: remapTenantGovernance(SEED_GOVERNANCE_GROUPS, tenantId),
    accessRules: remapTenantGovernance(SEED_GOVERNANCE_ACCESS_RULES, tenantId),
    extractionRules: remapTenantGovernance(SEED_GOVERNANCE_EXTRACTION_RULES, tenantId),
  };
}

export function buildPipelineOwnershipFilterForTenant(tenantId: string): Record<string, unknown> {
  const storage = resolveTenantStorageContextFromIds({
    tenantId,
    tenantType: 'business',
    collectionPrefix: tenantId,
  });
  return buildClassRuleOwnershipFilter(storage);
}

export function countSeedRowsMatchingPipelineFilter(
  seed: TenantGovernanceSeed,
  tenantId: string,
): {
  activeCategories: number;
  activeExtractionRules: number;
  activeAccessRules: number;
} {
  const filter = buildPipelineOwnershipFilterForTenant(tenantId);

  const matches = (row: Record<string, unknown>) =>
    Object.entries(filter).every(([key, value]) => {
      if (key === '$and' && Array.isArray(value)) {
        return value.every((clause) =>
          Object.entries(clause as Record<string, unknown>).every(([innerKey, innerValue]) => {
            if (innerKey === '$or' && Array.isArray(innerValue)) {
              return innerValue.some((option) => {
                if (typeof option !== 'object' || option === null) return false;
                return Object.entries(option as Record<string, unknown>).every(
                  ([optionKey, optionValue]) => row[optionKey] === optionValue,
                );
              });
            }
            return row[innerKey] === innerValue;
          }),
        );
      }

      if (key === '$or' && Array.isArray(value)) {
        return value.some((option) => {
          if (typeof option !== 'object' || option === null) return false;
          return Object.entries(option as Record<string, unknown>).every(
            ([optionKey, optionValue]) => row[optionKey] === optionValue,
          );
        });
      }

      return row[key] === value;
    });

  return {
    activeCategories: seed.categories.filter((row) => row.active && matches(row)).length,
    activeExtractionRules: seed.extractionRules.filter((row) => row.active && matches(row)).length,
    activeAccessRules: seed.accessRules.filter((row) => row.active && matches(row)).length,
  };
}

export const DEFAULT_CONNECTION_PERMISSIONS: MongoDocumentAccessPermissions = {
  view: true,
  download: true,
  upload: false,
  share: false,
  manage: false,
};
