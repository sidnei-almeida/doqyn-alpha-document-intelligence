import { randomUUID } from 'node:crypto';
import { isMongoNativeConfigured } from '../../db/mongoClient.js';
import type { NotificationChannel } from '../../db/notificationTypes.js';
import type {
  MongoDocument,
  MongoDocumentExpiryAlertConfig,
  MongoDocumentExtractionRule,
  MongoDocumentGroupMember,
  MongoNotification,
} from '../../db/types.js';
import { listActiveTenantMemberUserIds } from '../tenantMembersService.js';
import { getTenantCollections } from '../../tenancy/getTenantCollections.js';
import { loadGovernanceAccessIndex } from '../../tenancy/governanceAccessIndex.js';
import { tenantScopeFilterFromContext } from '../../tenancy/tenantQuery.js';
import { logger } from '../../utils/logger.js';
import {
  channelsForMember,
  loadNotificationPreferences,
} from '../notifications/notificationPreferences.js';
import { persistNotifications } from '../notifications/notificationService.js';

export const DEFAULT_EXPIRY_OFFSETS_DAYS = [30, 7, 1];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Teto de registros por `insertMany`, para não gravar dezenas de milhares numa tacada. */
const ALERT_INSERT_BATCH_SIZE = 500;

/** Teto de documentos lidos por varredura de tenant, para não carregar a coleção inteira. */
const DOCUMENT_SCAN_LIMIT = 5_000;

/**
 * Quantos dias para trás a varredura ainda olha documentos já vencidos.
 *
 * Serve de recuperação: se a varredura ficou parada num fim de semana, o documento que venceu no
 * intervalo ainda recebe o último aviso. É limitado de propósito — sem teto, toda execução
 * reprocessaria o histórico inteiro de vencidos. Quem já recebeu o marco não recebe de novo, por
 * causa do índice único.
 */
const EXPIRY_LOOKBACK_DAYS = 7;

/**
 * Meia-noite **UTC**, para contar dias de calendário em vez de períodos de 24h.
 *
 * Precisa ser UTC porque `projectSearchMeta` grava `validityDate` com `Date.UTC`. Usando meia-noite
 * local, qualquer host a oeste de UTC — America/Sao_Paulo, por exemplo — erraria por um dia: o
 * documento que vence em 10/08 apareceria como "vence hoje" no dia 09.
 */
function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
}

/**
 * Faixa de `validityDate` que a varredura precisa ler.
 *
 * O piso nunca pode ser positivo. Com marcos só positivos — `[30, 7, 1]`, ou pior, `[30]` — usar o
 * menor marco como piso empurraria o início da janela para o futuro e excluiria justamente os
 * documentos mais próximos de vencer: quem vence hoje tem `daysRemaining` zero.
 *
 * Abaixo de zero ainda entra `EXPIRY_LOOKBACK_DAYS` de recuperação, para que uma varredura parada
 * por alguns dias não engula em silêncio o último aviso de quem venceu no intervalo.
 */
export function computeScanWindow(offsetsDays: number[], now: Date): { start: Date; end: Date } {
  const maxAhead = Math.max(...offsetsDays);
  const minBehind = Math.min(0, ...offsetsDays) - EXPIRY_LOOKBACK_DAYS;

  const start = startOfDay(new Date(now.getTime() + minBehind * MS_PER_DAY));
  const end = new Date(
    startOfDay(new Date(now.getTime() + maxAhead * MS_PER_DAY)).getTime() + MS_PER_DAY - 1,
  );

  return { start, end };
}

export function daysUntil(validityDate: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(validityDate).getTime() - startOfDay(now).getTime()) / MS_PER_DAY);
}

export function normalizeExpiryAlertConfig(
  raw: Partial<MongoDocumentExpiryAlertConfig> | undefined,
): MongoDocumentExpiryAlertConfig {
  const offsets = Array.isArray(raw?.offsetsDays)
    ? raw.offsetsDays
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= -365 && value <= 365)
    : DEFAULT_EXPIRY_OFFSETS_DAYS;

  const notifyAfterExpiry = raw?.notifyAfterExpiry ?? false;

  return {
    enabled: raw?.enabled ?? false,
    // Ordem decrescente: o marco mais distante primeiro, como o usuário lê a configuração.
    offsetsDays: [...new Set(notifyAfterExpiry ? offsets : offsets.filter((o) => o >= 0))].sort(
      (a, b) => b - a,
    ),
    notifyGroupIds: [
      ...new Set((raw?.notifyGroupIds ?? []).map((id) => String(id).trim()).filter(Boolean)),
    ],
    notifyAfterExpiry,
  };
}

/**
 * Qual marco se aplica hoje a um documento.
 *
 * Devolve o marco **mais próximo já alcançado**, não todos: se a avaliação não rodou por três
 * dias, o documento não deve disparar três alertas de uma vez. O marco de 30 dias vale enquanto
 * faltar 30 dias ou menos e nenhum marco menor tiver sido atingido.
 */
export function resolveDueOffset(daysRemaining: number, offsetsDays: number[]): number | null {
  const reached = offsetsDays.filter((offset) => daysRemaining <= offset);
  if (reached.length === 0) return null;
  return Math.min(...reached);
}

async function resolveGroupRecipients(
  tenantId: string,
  groupIds: string[],
): Promise<Map<string, Set<string>>> {
  const byGroup = new Map<string, Set<string>>();
  if (groupIds.length === 0) return byGroup;

  const collections = await getTenantCollections(tenantId);
  if (!collections.documentGroupMembers) return byGroup;

  const members = (await collections.documentGroupMembers
    .find({
      ...tenantScopeFilterFromContext(collections.storage),
      groupId: { $in: groupIds },
      active: true,
    } as Record<string, unknown>)
    .toArray()) as MongoDocumentGroupMember[];

  for (const member of members) {
    if (!member.userId) continue;
    const set = byGroup.get(member.groupId) ?? new Set<string>();
    set.add(member.userId);
    byGroup.set(member.groupId, set);
  }

  return byGroup;
}

/**
 * Quem é avisado sobre uma categoria.
 *
 * A audiência sai do mapa de governança — os grupos com `view` na categoria — e nunca da lista
 * configurada no alerta sozinha. `notifyGroupIds` só **restringe** esse conjunto.
 *
 * Sem a interseção, escolher no alerta um grupo que não vê a categoria entregaria a essas pessoas
 * o nome do documento e da categoria que elas não podem abrir; e desconectar o grupo no mapa de
 * regras não desligaria o aviso, porque a lista do alerta continuaria lá.
 *
 * Lista vazia = todos os grupos que veem a categoria. É o default útil: configurar antecedência
 * sem escolher grupo passa a avisar quem tem acesso, em vez de ficar mudo.
 */
export function resolveAlertGroupIds(
  viewGroupIds: Set<string> | undefined,
  notifyGroupIds: string[],
): string[] {
  const allowed = viewGroupIds ? [...viewGroupIds] : [];
  if (notifyGroupIds.length === 0) return allowed;

  const restriction = new Set(notifyGroupIds);
  return allowed.filter((groupId) => restriction.has(groupId));
}

export type ExpiryEvaluationResult = {
  documentsScanned: number;
  alertsCreated: number;
  documentsWithoutRecipients: number;
};

type TenantCollections = Awaited<ReturnType<typeof getTenantCollections>>;

/** Categorias com alerta ligado e ao menos um marco válido. */
async function loadAlertConfigsByCategory(
  collections: TenantCollections,
  scope: Record<string, unknown>,
): Promise<Map<string, MongoDocumentExpiryAlertConfig>> {
  const configByCategory = new Map<string, MongoDocumentExpiryAlertConfig>();
  if (!collections.documentExtractionRules) return configByCategory;

  const rules = (await collections.documentExtractionRules
    .find({ ...scope, active: true } as Record<string, unknown>)
    .toArray()) as MongoDocumentExtractionRule[];

  for (const rule of rules) {
    const config = normalizeExpiryAlertConfig(rule.expiryAlerts);
    // Sem grupo configurado a categoria continua valendo: a audiência vem da governança, e a
    // lista do alerta é só restrição.
    if (!config.enabled || config.offsetsDays.length === 0) continue;
    configByCategory.set(rule.categoryId, config);
  }

  return configByCategory;
}

async function scanDueDocuments(
  collections: TenantCollections,
  scope: Record<string, unknown>,
  configByCategory: Map<string, MongoDocumentExpiryAlertConfig>,
  now: Date,
): Promise<MongoDocument[]> {
  // Janela: do marco mais distante configurado até o mais negativo. Fora dela não há o que avisar,
  // então o filtro evita varrer documentos com vencimento distante.
  const allOffsets = [...configByCategory.values()].flatMap((config) => config.offsetsDays);
  const { start: windowStart, end: windowEnd } = computeScanWindow(allOffsets, now);

  return (await collections.documents
    .find({
      ...scope,
      status: 'active',
      deletedAt: { $in: [null, undefined] },
      classId: { $in: [...configByCategory.keys()] },
      'searchMeta.validityDate': { $gte: windowStart, $lte: windowEnd },
    } as Record<string, unknown>)
    .limit(DOCUMENT_SCAN_LIMIT)
    .toArray()) as MongoDocument[];
}

export function buildPendingExpiryNotifications(input: {
  tenantId: string;
  documents: MongoDocument[];
  configByCategory: Map<string, MongoDocumentExpiryAlertConfig>;
  now: Date;
  resolveRecipients: (document: MongoDocument) => Set<string>;
}): { pending: MongoNotification[]; documentsWithoutRecipients: number } {
  const pending: MongoNotification[] = [];
  let documentsWithoutRecipients = 0;

  for (const document of input.documents) {
    const validityDate = document.searchMeta?.validityDate;
    if (!validityDate) continue;

    const config = input.configByCategory.get(document.classId);
    if (!config) continue;

    const daysRemaining = daysUntil(new Date(validityDate), input.now);
    const offsetDays = resolveDueOffset(daysRemaining, config.offsetsDays);
    if (offsetDays === null) continue;

    const userIds = input.resolveRecipients(document);

    if (userIds.size === 0) {
      documentsWithoutRecipients += 1;
      continue;
    }

    const documentName = document.title || document.currentFileName || document.documentCode;

    for (const userId of userIds) {
      pending.push({
        _id: `notif_${randomUUID()}`,
        tenantId: input.tenantId,
        companyId: input.tenantId,
        type: 'document_expiring',
        userId,
        // O marco faz parte da identidade do fato: cada antecedência avisa uma vez.
        eventKey: `${document._id}:${offsetDays}`,
        title: expiryNotificationTitle(documentName, daysRemaining),
        documentId: document._id,
        documentName,
        categoryId: document.classId,
        categoryName: document.className,
        expiry: {
          offsetDays,
          validityDate: new Date(validityDate),
          daysRemaining,
        },
        status: 'unread',
        createdAt: input.now,
        readAt: null,
      });
    }
  }

  return { pending, documentsWithoutRecipients };
}

/** O título carrega o prazo porque é o que o sino mostra sem abrir. */
export function expiryNotificationTitle(documentName: string, daysRemaining: number): string {
  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining);
    return `${documentName} venceu há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  }
  if (daysRemaining === 0) return `${documentName} vence hoje`;
  return `${documentName} vence em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}`;
}

/**
 * Avalia os documentos de um tenant e cria os alertas de vencimento devidos.
 *
 * Idempotente: o índice único (documentId, userId, offsetDays) faz a segunda execução do mesmo
 * marco ser descartada, então rodar duas vezes no mesmo dia não incomoda o usuário de novo.
 */
export async function evaluateTenantExpiryAlerts(
  tenantId: string,
  now: Date = new Date(),
): Promise<ExpiryEvaluationResult> {
  if (!isMongoNativeConfigured()) {
    return { documentsScanned: 0, alertsCreated: 0, documentsWithoutRecipients: 0 };
  }

  const { storage } = await getTenantCollections(tenantId);

  // PF não tem grupo documental nem mapa de governança, e o filtro de ownership exige o `userId`
  // do dono — por isso o caminho é outro, não uma ausência de alerta.
  return storage.storageMode === 'shared_individual_collection'
    ? evaluateIndividualTenantExpiryAlerts(tenantId, now)
    : evaluateBusinessTenantExpiryAlerts(tenantId, now);
}

async function evaluateBusinessTenantExpiryAlerts(
  tenantId: string,
  now: Date,
): Promise<ExpiryEvaluationResult> {
  const result: ExpiryEvaluationResult = {
    documentsScanned: 0,
    alertsCreated: 0,
    documentsWithoutRecipients: 0,
  };

  const collections = await getTenantCollections(tenantId);
  const scope = tenantScopeFilterFromContext(collections.storage);

  const configByCategory = await loadAlertConfigsByCategory(collections, scope);
  if (configByCategory.size === 0) return result;

  // Mapa de governança ativo: é ele que decide quem vê cada categoria. Ler aqui, uma vez por
  // varredura, evita repetir a consulta por documento.
  const governanceIndex = await loadGovernanceAccessIndex(tenantId);

  const groupsByCategory = new Map<string, string[]>();
  for (const [categoryId, config] of configByCategory) {
    groupsByCategory.set(
      categoryId,
      resolveAlertGroupIds(governanceIndex.viewByCategory.get(categoryId), config.notifyGroupIds),
    );
  }

  const documents = await scanDueDocuments(collections, scope, configByCategory, now);
  result.documentsScanned = documents.length;
  if (documents.length === 0) return result;

  const recipientsByGroup = await resolveGroupRecipients(tenantId, [
    ...new Set([...groupsByCategory.values()].flat()),
  ]);

  const { pending, documentsWithoutRecipients } = buildPendingExpiryNotifications({
    tenantId: collections.storage.tenantId,
    documents,
    configByCategory,
    now,
    resolveRecipients: (document) => {
      const userIds = new Set<string>();
      for (const groupId of groupsByCategory.get(document.classId) ?? []) {
        for (const userId of recipientsByGroup.get(groupId) ?? []) userIds.add(userId);
      }

      // O dono é sempre avisado, esteja ou não em grupo: é ele quem renova, reassina ou substitui
      // o documento, e ele já tem acesso por ownership.
      if (document.ownerUserId) userIds.add(document.ownerUserId);
      return userIds;
    },
  });

  result.documentsWithoutRecipients = documentsWithoutRecipients;
  if (pending.length === 0) return result;

  result.alertsCreated = await persistExpiryNotifications(tenantId, pending);
  return result;
}

/**
 * Varredura de tenant PF, um dono por vez.
 *
 * O dono é o único destinatário possível — não há grupo nem governança — e é também o único que
 * pode ler os próprios documentos, então a leitura roda com o contexto dele. Uma conta PF tem um
 * membro; o laço existe porque nada no schema garante isso.
 */
async function evaluateIndividualTenantExpiryAlerts(
  tenantId: string,
  now: Date,
): Promise<ExpiryEvaluationResult> {
  const result: ExpiryEvaluationResult = {
    documentsScanned: 0,
    alertsCreated: 0,
    documentsWithoutRecipients: 0,
  };

  const ownerUserIds = await listActiveTenantMemberUserIds(tenantId);
  if (ownerUserIds.length === 0) {
    logger.warn('expiry sweep found no active member for individual tenant', { tenantId });
    return result;
  }

  for (const ownerUserId of ownerUserIds) {
    const collections = await getTenantCollections(tenantId, { userId: ownerUserId });
    const scope = tenantScopeFilterFromContext(collections.storage);

    const configByCategory = await loadAlertConfigsByCategory(collections, scope);
    if (configByCategory.size === 0) continue;

    const documents = await scanDueDocuments(collections, scope, configByCategory, now);
    result.documentsScanned += documents.length;
    if (documents.length === 0) continue;

    const { pending, documentsWithoutRecipients } = buildPendingExpiryNotifications({
      tenantId: collections.storage.tenantId,
      documents,
      configByCategory,
      now,
      // O filtro de ownership já restringe a varredura aos documentos deste dono; `ownerUserId`
      // do registro é preferido só para não avisar a pessoa errada se o filtro mudar um dia.
      resolveRecipients: (document) => new Set([document.ownerUserId || ownerUserId]),
    });

    result.documentsWithoutRecipients += documentsWithoutRecipients;
    if (pending.length === 0) continue;

    result.alertsCreated += await persistExpiryNotifications(tenantId, pending);
  }

  return result;
}

/**
 * Grava os avisos de vencimento pelo motor de notificações.
 *
 * O canal sai da preferência do destinatário, lida uma vez por varredura: por documento seria uma
 * consulta de membros por documento. Note que a preferência decide **por onde**, nunca **se** —
 * vencimento não tem chave de preferência (ver `PREFERENCE_KEY_BY_TYPE`), porque é o documento
 * dizendo que deixa de valer, não um aviso de cortesia.
 */
async function persistExpiryNotifications(
  tenantId: string,
  pending: MongoNotification[],
): Promise<number> {
  if (pending.length === 0) return 0;

  const preferences = await loadNotificationPreferences(
    tenantId,
    pending.map((notification) => notification.userId),
  );

  const channelsByUserId = new Map<string, NotificationChannel[]>();
  for (const [userId, memberPreferences] of preferences) {
    channelsByUserId.set(userId, channelsForMember(memberPreferences));
  }

  return persistNotifications(pending, channelsByUserId);
}
