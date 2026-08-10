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

/**
 * `_id` do seed com o tenant embutido.
 *
 * As constantes de seed usam ids fixos (`cat_contratos`, `group_diretoria`). Enquanto cada tenant
 * tinha coleções próprias isso era inofensivo; com as coleções compartilhadas o `_id` é global, e
 * semear um segundo tenant colidiria com as linhas do primeiro.
 */
function scopeSeedId(id: string, tenantId: string): string {
  return `${id}__${tenantId}`;
}

/**
 * Reescreve `_id` e as referências entre linhas do seed para o tenant.
 *
 * `categoryId`, `classId` e `groupId` apontam para os mesmos ids fixos, então precisam do mesmo
 * sufixo — senão a regra de acesso do tenant B continuaria apontando para a categoria do tenant A.
 */
function remapTenantGovernance<T extends { tenantId: string; companyId: string; _id: string }>(
  rows: T[],
  tenantId: string,
) {
  return rows.map((row) => {
    const scoped = applyBusinessGovernanceOwnership(row, tenantId);
    const references: Record<string, unknown> = {};

    for (const field of ['categoryId', 'classId', 'groupId'] as const) {
      const value = (row as Record<string, unknown>)[field];
      if (typeof value === 'string' && value) references[field] = scopeSeedId(value, tenantId);
    }

    return { ...scoped, ...references, _id: scopeSeedId(row._id, tenantId) };
  });
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

  const matchesOwnershipClause = (
    row: Record<string, unknown>,
    clause: Record<string, unknown>,
  ): boolean =>
    Object.entries(clause).every(([optionKey, optionValue]) => {
      if (optionKey === '$or' && Array.isArray(optionValue)) {
        return optionValue.some((nested) =>
          matchesOwnershipClause(row, nested as Record<string, unknown>),
        );
      }
      if (
        typeof optionValue === 'object' &&
        optionValue !== null &&
        '$exists' in (optionValue as Record<string, unknown>)
      ) {
        const exists = (optionValue as { $exists: boolean }).$exists;
        return exists ? row[optionKey] !== undefined : row[optionKey] === undefined;
      }
      if (
        typeof optionValue === 'object' &&
        optionValue !== null &&
        '$in' in (optionValue as Record<string, unknown>)
      ) {
        const values = (optionValue as { $in: unknown[] }).$in;
        return values.includes(row[optionKey]);
      }
      return row[optionKey] === optionValue;
    });

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
        return value.some((option) => matchesOwnershipClause(row, option as Record<string, unknown>));
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
