import {
  toPermissionState,
  type GovernancePermissionState,
} from '../../shared/governancePermissions.js';
import type { MongoDocumentAccessPermissions, MongoDocumentAccessRule } from '../db/types.js';
import { listDocumentAccessRules } from '../services/documentAccessRulesService.js';

/**
 * Verbo de autorização, na linguagem do domínio.
 *
 * Deliberadamente **não** é `keyof MongoDocumentAccessPermissions`. Os campos persistidos ainda se
 * chamam `upload` e `manage` por herança do primeiro desenho, mas os buckets que eles alimentam
 * sempre foram `updateByCategory` e `auditByCategory`, e o frontend já fala `update`/`audit` no seu
 * modelo de domínio (`src/features/rules/api/rulesApi.ts`). O único lugar que ainda obrigava a
 * autorização a falar `'upload'` para perguntar "pode alterar?" era este alias.
 *
 * Renomear o campo persistido exigiria migração de dados no Mongo por ganho puramente cosmético;
 * renomear o verbo não custa nada e deixa o call site honesto.
 */
export type GovernancePermissionKey = 'view' | 'download' | 'update' | 'audit' | 'share';

/**
 * Por categoria, o estado de cada grupo naquele verbo.
 *
 * Era `Set<groupId>` — quem estava no conjunto podia. Virou mapa porque o conjunto não sabe
 * responder "pode pedindo": manter dois conjuntos por verbo dobraria a estrutura e deixaria dois
 * lugares onde um grupo pode aparecer, com a pergunta óbvia do que fazer quando aparece nos dois.
 */
export type GovernanceCategoryStates = Map<string, Map<string, GovernancePermissionState>>;

export type GovernanceAccessIndex = {
  viewByCategory: GovernanceCategoryStates;
  downloadByCategory: GovernanceCategoryStates;
  updateByCategory: GovernanceCategoryStates;
  auditByCategory: GovernanceCategoryStates;
  shareByCategory: GovernanceCategoryStates;
};

/** Tradução campo persistido → bucket. É a única fronteira que conhece os nomes legados. */
const PERMISSION_BUCKETS: Array<{
  storedKey: keyof MongoDocumentAccessPermissions;
  target: keyof GovernanceAccessIndex;
}> = [
  { storedKey: 'view', target: 'viewByCategory' },
  { storedKey: 'download', target: 'downloadByCategory' },
  { storedKey: 'upload', target: 'updateByCategory' },
  { storedKey: 'manage', target: 'auditByCategory' },
  { storedKey: 'share', target: 'shareByCategory' },
];

const BUCKET_BY_PERMISSION: Record<GovernancePermissionKey, keyof GovernanceAccessIndex> = {
  view: 'viewByCategory',
  download: 'downloadByCategory',
  update: 'updateByCategory',
  audit: 'auditByCategory',
  share: 'shareByCategory',
};

function createEmptyGovernanceAccessIndex(): GovernanceAccessIndex {
  return {
    viewByCategory: new Map(),
    downloadByCategory: new Map(),
    updateByCategory: new Map(),
    auditByCategory: new Map(),
    shareByCategory: new Map(),
  };
}

/**
 * Estado mais permissivo vence quando o mesmo grupo cai duas vezes na mesma célula.
 *
 * Duas regras ativas para (grupo, categoria) não deveriam existir — o upsert é por par — mas dado
 * herdado pode ter. Escolher o mais permissivo mantém o comportamento anterior, em que bastava uma
 * regra dizer `true` para o grupo entrar no conjunto.
 */
const STATE_RANK: Record<GovernancePermissionState, number> = { deny: 0, require: 1, allow: 2 };

function addGroupToCategoryBucket(
  bucket: GovernanceCategoryStates,
  categoryId: string,
  groupId: string,
  state: GovernancePermissionState,
): void {
  const current = bucket.get(categoryId) ?? new Map<string, GovernancePermissionState>();
  const previous = current.get(groupId);
  if (!previous || STATE_RANK[state] > STATE_RANK[previous]) {
    current.set(groupId, state);
  }
  bucket.set(categoryId, current);
}

export function buildGovernanceAccessIndex(
  rules: Pick<MongoDocumentAccessRule, 'categoryId' | 'groupId' | 'permissions' | 'active'>[],
): GovernanceAccessIndex {
  const index = createEmptyGovernanceAccessIndex();

  for (const rule of rules) {
    if (!rule.active) continue;
    if (!rule.categoryId || !rule.groupId) continue;

    for (const { storedKey, target } of PERMISSION_BUCKETS) {
      const state = toPermissionState(rule.permissions[storedKey]);
      if (state === 'deny') continue;
      addGroupToCategoryBucket(index[target], rule.categoryId, rule.groupId, state);
    }
  }

  return index;
}

export async function loadGovernanceAccessIndex(
  tenantId: string,
  opts?: { ownerUserId?: string },
): Promise<GovernanceAccessIndex> {
  const rules = await listDocumentAccessRules(tenantId, opts);
  return buildGovernanceAccessIndex(
    rules.map((rule) => ({
      categoryId: rule.categoryId,
      groupId: rule.groupId,
      permissions: rule.permissions,
      active: rule.active,
    })),
  );
}

/**
 * O estado do usuário naquele verbo, sobre aquela categoria.
 *
 * O grupo mais permissivo vence: quem está em Gestão e em Comercial compartilha direto, porque
 * pertencer a mais grupos nunca pode tirar direito.
 */
export function resolveGovernanceCategoryPermission(
  index: GovernanceAccessIndex | undefined,
  categoryId: string | undefined,
  memberGroupIds: string[],
  permission: GovernancePermissionKey,
): GovernancePermissionState {
  if (!index || !categoryId?.trim() || memberGroupIds.length === 0) return 'deny';

  const states = index[BUCKET_BY_PERMISSION[permission]].get(categoryId);
  if (!states?.size) return 'deny';

  let best: GovernancePermissionState = 'deny';
  for (const groupId of memberGroupIds) {
    const state = states.get(groupId);
    if (state && STATE_RANK[state] > STATE_RANK[best]) best = state;
  }
  return best;
}

/**
 * Mantido porque a maioria dos chamadores só quer saber se há caminho.
 *
 * `require` conta como "tem", e não como "pode agora": quem decide o que fazer com o caminho do
 * meio é `documentAccess.ts`, que chama `resolveGovernanceCategoryPermission`. Tratar `require`
 * como negado aqui esconderia a categoria de quem pode pedir acesso a ela.
 */
export function userHasGovernanceCategoryPermission(
  index: GovernanceAccessIndex | undefined,
  categoryId: string | undefined,
  memberGroupIds: string[],
  permission: GovernancePermissionKey,
): boolean {
  return (
    resolveGovernanceCategoryPermission(index, categoryId, memberGroupIds, permission) !== 'deny'
  );
}

/**
 * Grupos com algum caminho para o verbo naquela categoria — liberado ou mediante pedido.
 *
 * Quem só precisa saber "quem alcança isto" — audiência de notificação, alerta de vencimento, a
 * Matriz — quer os dois. Distinguir é trabalho de quem vai executar a ação.
 */
export function groupIdsReaching(
  bucket: GovernanceCategoryStates,
  categoryId: string | undefined,
): Set<string> {
  if (!categoryId) return new Set();
  return new Set(bucket.get(categoryId)?.keys() ?? []);
}

export function listGovernanceViewableCategoryIds(
  index: GovernanceAccessIndex,
  memberGroupIds: string[],
): string[] {
  if (memberGroupIds.length === 0) return [];

  const memberGroupSet = new Set(memberGroupIds);
  const categoryIds: string[] = [];

  for (const [categoryId, states] of index.viewByCategory.entries()) {
    for (const groupId of states.keys()) {
      if (memberGroupSet.has(groupId)) {
        categoryIds.push(categoryId);
        break;
      }
    }
  }

  return categoryIds;
}
