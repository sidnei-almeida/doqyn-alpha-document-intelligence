import type { AuthUser } from '../../auth/types.js';
import type {
  MongoDocument,
  MongoDocumentExpiryAlertConfig,
  MongoDocumentExtractionRule,
  MongoDocumentVersion,
  MongoRuleField,
  MongoVersionMetadataField,
} from '../../db/types.js';
import { projectDocumentSearchMeta, VALIDITY_SOURCE_KEYS } from '../confirm/projectSearchMeta.js';
import {
  assertCanUpdateDocument,
  loadDocumentAccessContext,
  resolveDocumentPermissions,
  type DocumentAccessPermissions,
} from '../../tenancy/documentAccess.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { tenantScopeFilterFromContext } from '../../tenancy/tenantQuery.js';
import { ServiceError } from '../../utils/serviceErrors.js';
import {
  clearDocumentExpiryAlerts,
  daysUntil,
  normalizeExpiryAlertConfig,
  resolveDueOffset,
} from './documentExpiryAlertService.js';
import { enqueueTenantExpiryEvaluation } from '../../queues/expiryAlertQueue.js';
import { logger } from '../../utils/logger.js';

export type MetadataFieldPatch = {
  key: string;
  label?: string;
  value: string | number | null;
};

export type DocumentMetadataEditResult = {
  documentId: string;
  versionId: string;
  updatedKeys: string[];
  removedKeys: string[];
  validityDate: string | null;
};

function sanitizeKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed || trimmed.length > 80 || !/^[\w.-]+$/.test(trimmed)) {
    throw new ServiceError(`Chave de metadado inválida: "${key}".`, 'INVALID_METADATA_KEY', 400);
  }
  return trimmed;
}

function sanitizeValue(value: string | number | null): string | number | null {
  if (value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ServiceError('Valor numérico inválido.', 'INVALID_METADATA_VALUE', 400);
    }
    return value;
  }
  const trimmed = String(value).trim();
  if (trimmed.length > 2_000) {
    throw new ServiceError(
      'Valor de metadado excede 2000 caracteres.',
      'INVALID_METADATA_VALUE',
      400,
    );
  }
  return trimmed === '' ? null : trimmed;
}

/**
 * Edita à mão os metadados da versão atual de um documento.
 *
 * Existe porque a extração por IA erra ou não encontra o campo — em documento escaneado ruim,
 * por exemplo, o vencimento simplesmente não sai. Sem isto o usuário não tinha como corrigir
 * depois da confirmação do upload, e o alerta de vencimento nunca dispararia.
 *
 * Campos editados ficam com `source: 'manual'` e `confidence: 1`: são verdade informada por uma
 * pessoa, e a reextração de uma nova versão não deve rebaixá-los silenciosamente.
 */
export async function updateDocumentMetadata(input: {
  tenantId: string;
  documentId: string;
  user: AuthUser;
  userId: string;
  membershipId?: string;
  fields: MetadataFieldPatch[];
}): Promise<DocumentMetadataEditResult> {
  if (input.fields.length === 0) {
    throw new ServiceError('Nenhum campo informado.', 'NO_FIELDS', 400);
  }
  if (input.fields.length > 100) {
    throw new ServiceError('Máximo de 100 campos por edição.', 'TOO_MANY_FIELDS', 400);
  }

  const collections = await getTenantCollections(input.tenantId, {
    userId: input.userId,
    membershipId: input.membershipId,
  });
  const scope = tenantScopeFilterFromContext(collections.storage);

  const document = (await collections.documents.findOne({
    _id: input.documentId,
    ...scope,
  } as Record<string, unknown>)) as MongoDocument | null;

  if (!document) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: input.tenantId,
    userId: input.userId,
    membershipId: input.membershipId,
  });

  // Editar metadado é alterar o documento: exige a mesma permissão de atualização.
  assertCanUpdateDocument(
    resolveDocumentPermissions(input.user, document, memberGroupIds, governanceIndex),
  );

  const version = (await collections.documentVersions.findOne({
    _id: document.currentVersionId,
    ...scope,
  } as Record<string, unknown>)) as MongoDocumentVersion | null;

  if (!version) {
    throw new ServiceError('Versão atual não encontrada.', 'VERSION_NOT_FOUND', 404);
  }

  const metadata: Record<string, MongoVersionMetadataField> = { ...(version.metadata ?? {}) };
  const updatedKeys: string[] = [];
  const removedKeys: string[] = [];

  for (const patch of input.fields) {
    const key = sanitizeKey(patch.key);
    const value = sanitizeValue(patch.value);

    if (value === null) {
      // Valor vazio apaga o campo em vez de gravar null: um campo presente e vazio confundiria a
      // projeção de busca e a leitura de vencimento.
      if (key in metadata) {
        delete metadata[key];
        removedKeys.push(key);
      }
      continue;
    }

    const previous = metadata[key];
    metadata[key] = {
      label: patch.label?.trim() || previous?.label || key,
      value,
      normalizedValue: value,
      confidence: 1,
      source: 'manual',
      ...(previous?.page !== undefined ? { page: previous.page } : {}),
      ...(previous?.currency ? { currency: previous.currency } : {}),
    };
    updatedKeys.push(key);
  }

  if (updatedKeys.length === 0 && removedKeys.length === 0) {
    throw new ServiceError('Nenhuma alteração aplicada.', 'NO_CHANGES', 400);
  }

  const ruleFields = await loadCategoryRuleFields(collections, scope, document.classId);
  const searchMeta = projectDocumentSearchMeta(metadata, ruleFields);

  const previousValidity = document.searchMeta?.validityDate
    ? new Date(document.searchMeta.validityDate).getTime()
    : null;
  const nextValidity = searchMeta.validityDate ? new Date(searchMeta.validityDate).getTime() : null;
  const validityChanged = previousValidity !== nextValidity;

  const now = new Date();

  await collections.documentVersions.updateOne({ _id: version._id } as Record<string, unknown>, {
    $set: { metadata, updatedAt: now },
  });

  await collections.documents.updateOne({ _id: document._id } as Record<string, unknown>, {
    $set: {
      searchMeta,
      updatedAt: now,
      updatedBy: input.userId,
      updatedByName: input.user.name,
    },
  });

  if (validityChanged) {
    // Alertas do vencimento antigo não valem mais. Descartá-los também libera a chave única
    // (documento, usuário, marco) para o novo vencimento poder alertar.
    await clearDocumentExpiryAlerts({
      tenantId: collections.storage.tenantId,
      documentId: document._id,
    });
    await enqueueTenantExpiryEvaluation(collections.storage.tenantId).catch(() => false);

    logger.info('document validity date changed manually', {
      tenantId: collections.storage.tenantId,
      documentId: document._id,
      validityDate: searchMeta.validityDate?.toISOString() ?? null,
    });
  }

  return {
    documentId: document._id,
    versionId: version._id,
    updatedKeys,
    removedKeys,
    validityDate: searchMeta.validityDate ? new Date(searchMeta.validityDate).toISOString() : null,
  };
}

async function loadCategoryRule(
  collections: Awaited<ReturnType<typeof getTenantCollections>>,
  scope: Record<string, unknown>,
  categoryId: string,
): Promise<MongoDocumentExtractionRule | null> {
  if (!collections.documentExtractionRules) return null;

  const rule = await collections.documentExtractionRules.findOne(
    { ...scope, categoryId, active: true } as Record<string, unknown>,
    { sort: { version: -1 } },
  );

  return (rule as MongoDocumentExtractionRule | null) ?? null;
}

async function loadCategoryRuleFields(
  collections: Awaited<ReturnType<typeof getTenantCollections>>,
  scope: Record<string, unknown>,
  categoryId: string,
): Promise<MongoRuleField[] | undefined> {
  const rule = await loadCategoryRule(collections, scope, categoryId);
  return rule?.fields ?? undefined;
}

/** Uma linha da ficha de metadados: campo previsto pela regra, preenchido ou não. */
export type MetadataSheetRow = {
  key: string;
  label: string;
  type: MongoRuleField['type'];
  required: boolean;
  description?: string;
  value: string | number | null;
  source?: MongoVersionMetadataField['source'];
  confidence?: number;
  /** Previsto pela regra da categoria (tenant). Falso = chave extra gravada à mão. */
  fromRule: boolean;
  filled: boolean;
  /** Alimenta `searchMeta.validityDate`: preencher esta linha é o que liga os alertas. */
  isValidity: boolean;
};

export type DocumentMetadataSheet = {
  documentId: string;
  versionId: string;
  categoryId: string;
  categoryName?: string;
  canEdit: boolean;
  validityDate: string | null;
  /** Negativo quando já vencido; nulo sem vencimento gravado. */
  daysRemaining: number | null;
  /** Config da categoria, para a tela dizer se o preenchimento gera alerta de fato. */
  expiryAlerts: MongoDocumentExpiryAlertConfig | null;
  /** Marco que já se aplica hoje, se houver — só com a config ativa. */
  dueOffsetDays: number | null;
  missingRequiredCount: number;
  rows: MetadataSheetRow[];
};

function isValidityKey(key: string): boolean {
  return VALIDITY_SOURCE_KEYS.has(key.toLowerCase());
}

/**
 * Junta o que a categoria espera com o que a versão tem.
 *
 * A ordem é a da regra — é como o usuário configurou a categoria — e as chaves extras (gravadas à
 * mão ou por uma regra antiga) vêm depois, para não sumirem da tela e virarem dado órfão.
 */
export function buildMetadataSheetRows(
  ruleFields: MongoRuleField[] | undefined,
  metadata: Record<string, MongoVersionMetadataField> | undefined,
): MetadataSheetRow[] {
  const present = metadata ?? {};
  const rows: MetadataSheetRow[] = [];
  const seen = new Set<string>();

  for (const field of ruleFields ?? []) {
    const value = present[field.key]?.value ?? null;
    seen.add(field.key);
    rows.push({
      key: field.key,
      label: field.label || field.key,
      type: field.type,
      required: field.required,
      description: field.description,
      value,
      source: present[field.key]?.source,
      confidence: present[field.key]?.confidence,
      fromRule: true,
      filled: value !== null && value !== '',
      isValidity: isValidityKey(field.key),
    });
  }

  for (const [key, field] of Object.entries(present)) {
    if (seen.has(key)) continue;
    rows.push({
      key,
      label: field.label || key,
      // Sem regra não há tipo declarado; `date` só quando a chave é reconhecida como vencimento,
      // para o campo abrir como seletor de data em vez de texto livre.
      type: isValidityKey(key) ? 'date' : 'string',
      required: false,
      value: field.value ?? null,
      source: field.source,
      confidence: field.confidence,
      fromRule: false,
      filled: field.value !== null && field.value !== undefined && field.value !== '',
      isValidity: isValidityKey(key),
    });
  }

  return rows;
}

/**
 * Ficha de metadados de um documento: o que a categoria espera, o que já veio da extração e o que
 * falta preencher à mão.
 *
 * Existe porque o painel mostrava apenas os campos extraídos — quem precisava descobrir o que
 * faltava tinha de adivinhar a chave. Com a regra da categoria em mãos, a tela lista as lacunas.
 */
export async function getDocumentMetadataSheet(input: {
  tenantId: string;
  documentId: string;
  user: AuthUser;
  userId: string;
  membershipId?: string;
  now?: Date;
}): Promise<DocumentMetadataSheet> {
  const collections = await getTenantCollections(input.tenantId, {
    userId: input.userId,
    membershipId: input.membershipId,
  });
  const scope = tenantScopeFilterFromContext(collections.storage);

  const document = (await collections.documents.findOne({
    _id: input.documentId,
    ...scope,
  } as Record<string, unknown>)) as MongoDocument | null;

  if (!document) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }

  const { memberGroupIds, governanceIndex } = await loadDocumentAccessContext({
    tenantId: input.tenantId,
    userId: input.userId,
    membershipId: input.membershipId,
  });

  const permissions: DocumentAccessPermissions = resolveDocumentPermissions(
    input.user,
    document,
    memberGroupIds,
    governanceIndex,
  );

  // Ler a ficha exige ao menos poder ver o documento; escrever é checado no PATCH.
  if (!permissions.canPreview && !permissions.canUpdate) {
    throw new ServiceError('Acesso negado ao documento.', 'DOCUMENT_ACCESS_DENIED', 403);
  }

  const version = (await collections.documentVersions.findOne({
    _id: document.currentVersionId,
    ...scope,
  } as Record<string, unknown>)) as MongoDocumentVersion | null;

  if (!version) {
    throw new ServiceError('Versão atual não encontrada.', 'VERSION_NOT_FOUND', 404);
  }

  const rule = await loadCategoryRule(collections, scope, document.classId);
  const rows = buildMetadataSheetRows(rule?.fields, version.metadata);

  const expiryAlerts = rule ? normalizeExpiryAlertConfig(rule.expiryAlerts) : null;
  const validityDate = document.searchMeta?.validityDate
    ? new Date(document.searchMeta.validityDate)
    : null;
  const daysRemaining = validityDate ? daysUntil(validityDate, input.now ?? new Date()) : null;

  return {
    documentId: document._id,
    versionId: version._id,
    categoryId: document.classId,
    categoryName: document.className,
    canEdit: permissions.canUpdate,
    validityDate: validityDate ? validityDate.toISOString() : null,
    daysRemaining,
    expiryAlerts,
    dueOffsetDays:
      daysRemaining !== null && expiryAlerts?.enabled
        ? resolveDueOffset(daysRemaining, expiryAlerts.offsetsDays)
        : null,
    missingRequiredCount: rows.filter((row) => row.required && !row.filled).length,
    rows,
  };
}
