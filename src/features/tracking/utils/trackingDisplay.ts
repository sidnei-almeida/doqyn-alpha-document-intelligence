/**
 * Rótulos e formatos da Central de Rastreamento.
 *
 * Duas naturezas convivem aqui, e cada uma resolve o idioma num momento diferente:
 *
 * **As listas de opção de filtro são constante de módulo.** Guardam `labelKey`, e quem monta o
 * `<Select>` resolve com o `t` do componente — resolver no import congelaria o idioma da sessão
 * inteira no primeiro carregamento do módulo.
 *
 * **As funções de formato resolvem na chamada.** Rodam por linha da tabela, já dentro do render,
 * e por isso podem falar direto com a instância do i18next.
 *
 * O mapa de ações vale um parágrafo à parte. A chave do catálogo é o próprio código do evento
 * (`document.upload_started`), e o ponto que separa domínio de ação vira nível de aninhamento no
 * JSON — o que é conveniente, não coincidência: o tradutor vê as ações de documento agrupadas.
 * Código sem frase escrita cai no formatador genérico, que continua legível em qualquer idioma
 * porque só reordena o próprio identificador.
 */
import { i18n } from '@/i18n';
import type { DocumentTrackingFilters, TrackingListStatus } from '@/types/document-tracking';

const NS = 'tracking';

function t(key: string, params?: Record<string, unknown>): string {
  return i18n.t(`${NS}:${key}`, params ?? {});
}

export const TRACKING_CATEGORY_OPTIONS = [
  { value: 'all', labelKey: 'tracking:filterOption.category.all' },
  { value: 'upload', labelKey: 'tracking:filterOption.category.upload' },
  { value: 'analysis', labelKey: 'tracking:filterOption.category.analysis' },
  { value: 'edit', labelKey: 'tracking:filterOption.category.edit' },
  { value: 'download', labelKey: 'tracking:filterOption.category.download' },
  { value: 'preview', labelKey: 'tracking:filterOption.category.preview' },
  { value: 'access', labelKey: 'tracking:filterOption.category.access' },
  { value: 'error', labelKey: 'tracking:filterOption.category.error' },
] as const;

export const TRACKING_SEVERITY_OPTIONS = [
  { value: '', labelKey: 'tracking:filterOption.severity.all' },
  { value: 'info', labelKey: 'tracking:filterOption.severity.info' },
  { value: 'warning', labelKey: 'tracking:filterOption.severity.warning' },
  { value: 'error', labelKey: 'tracking:filterOption.severity.error' },
  { value: 'critical', labelKey: 'tracking:filterOption.severity.critical' },
] as const;

export const TRACKING_STATUS_OPTIONS = [
  { value: '', labelKey: 'tracking:filterOption.status.all' },
  { value: 'success', labelKey: 'tracking:filterOption.status.success' },
  { value: 'failed', labelKey: 'tracking:filterOption.status.failed' },
  { value: 'denied', labelKey: 'tracking:filterOption.status.denied' },
  { value: 'pending', labelKey: 'tracking:filterOption.status.pending' },
] as const;

export const TRACKING_ACTION_GROUP_OPTIONS = [
  { value: '', labelKey: 'tracking:filterOption.actionGroup.all' },
  { value: 'lifecycle', labelKey: 'tracking:filterOption.actionGroup.lifecycle' },
  { value: 'preview', labelKey: 'tracking:filterOption.actionGroup.preview' },
  { value: 'download', labelKey: 'tracking:filterOption.actionGroup.download' },
  { value: 'access', labelKey: 'tracking:filterOption.actionGroup.access' },
  { value: 'storage', labelKey: 'tracking:filterOption.actionGroup.storage' },
  { value: 'explorer', labelKey: 'tracking:filterOption.actionGroup.explorer' },
  { value: 'governance', labelKey: 'tracking:filterOption.actionGroup.governance' },
] as const;

export function buildTrackingEventsQuery(filters: DocumentTrackingFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.q?.trim()) params.q = filters.q.trim();
  if (filters.documentId?.trim()) params.documentId = filters.documentId.trim();
  if (filters.versionId?.trim()) params.versionId = filters.versionId.trim();
  if (filters.action?.trim()) params.action = filters.action.trim();
  if (filters.severity?.trim()) params.severity = filters.severity.trim();
  if (filters.status?.trim()) params.status = filters.status.trim();
  if (filters.actionGroup?.trim()) params.actionGroup = filters.actionGroup.trim();
  if (filters.requestId?.trim()) params.requestId = filters.requestId.trim();
  if (filters.actorUserId?.trim()) params.actorUserId = filters.actorUserId.trim();
  if (filters.from?.trim()) params.from = filters.from.trim();
  if (filters.to?.trim()) params.to = filters.to.trim();
  if (filters.category && filters.category !== 'all') params.category = filters.category;

  return params;
}

/** Traço em vez de vazio: a célula da tabela precisa ocupar altura mesmo sem dado. */
const EMPTY_VALUE = '—';

export function formatTrackingAction(action: string): string {
  const key = `${NS}:actionLabel.${action}`;
  if (i18n.isInitialized && i18n.exists(key)) return i18n.t(key);
  return action
    .replace(/^document\./, '')
    .replace(/^access\./, t('actionFallback.accessPrefix'))
    .replace(/^file_explorer\./, t('actionFallback.explorerPrefix'))
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatTrackingSeverity(severity: string): string {
  const key = `${NS}:severityLabel.${severity}`;
  return i18n.isInitialized && i18n.exists(key) ? i18n.t(key) : severity;
}

export function formatTrackingStatus(status?: TrackingListStatus): string {
  if (!status) return EMPTY_VALUE;
  const key = `${NS}:statusLabel.${status}`;
  return i18n.isInitialized && i18n.exists(key) ? i18n.t(key) : status;
}

export function formatSessionOrigin(sessionHash?: string): string {
  if (!sessionHash) return EMPTY_VALUE;
  return `${sessionHash.slice(0, 8)}…`;
}

export type SecurityContextDisplay = {
  deviceLabel: string;
  deviceTypeLabel: string;
  locationLabel: string;
  ipLabel: string;
  sessionLabel: string;
  occurredAtLabel?: string;
  isExternalGuest: boolean;
};

function formatDeviceTypeLabel(deviceType?: unknown): string {
  switch (deviceType) {
    case 'mobile':
      return t('deviceType.mobile');
    case 'tablet':
      return t('deviceType.tablet');
    case 'desktop':
      return t('deviceType.desktop');
    default:
      return t('deviceType.unknown');
  }
}

/**
 * O par navegador/sistema é frase, não concatenação.
 *
 * Era `[browser, os].join(' em ')`. A preposição é do português, e a ordem não é universal — em
 * inglês o natural é "Chrome on macOS", e há idioma onde o sistema vem antes. Com os dois como
 * parâmetro de uma frase única, o tradutor decide a ordem e a ligação.
 */
function formatDeviceSummary(browser?: string, os?: string): string {
  if (browser && os) return t('securityContext.browserOnOs', { browser, os });
  return browser ?? os ?? '';
}

export function formatSecurityContextDisplay(
  securityContext?: Record<string, unknown> | null,
  occurredAt?: string,
): SecurityContextDisplay | null {
  if (!securityContext || Object.keys(securityContext).length === 0) return null;

  const browser = typeof securityContext.browser === 'string' ? securityContext.browser : undefined;
  const os = typeof securityContext.os === 'string' ? securityContext.os : undefined;
  const summary =
    typeof securityContext.userAgent === 'string'
      ? securityContext.userAgent
      : formatDeviceSummary(browser, os);

  const city = typeof securityContext.city === 'string' ? securityContext.city : undefined;
  const region = typeof securityContext.region === 'string' ? securityContext.region : undefined;
  const country = typeof securityContext.country === 'string' ? securityContext.country : undefined;
  const locationParts = [city, region, country].filter(Boolean);
  const ipLabel =
    typeof securityContext.ipAddressMasked === 'string'
      ? securityContext.ipAddressMasked
      : EMPTY_VALUE;
  /* `'rede local'` e `'1:…'` são valores gravados pelo servidor, não texto de tela — comparar
     com eles continua sendo comparação de dado, e não muda com o idioma da interface. */
  const isLocalNetwork =
    securityContext.isLocalNetwork === true || ipLabel === 'rede local' || ipLabel === '1:…';

  return {
    deviceLabel: summary || EMPTY_VALUE,
    deviceTypeLabel: formatDeviceTypeLabel(securityContext.deviceType),
    locationLabel: isLocalNetwork
      ? t('securityContext.localNetwork')
      : locationParts.length
        ? locationParts.join(', ')
        : EMPTY_VALUE,
    ipLabel,
    sessionLabel: formatSessionOrigin(
      typeof securityContext.sessionIdHash === 'string' ? securityContext.sessionIdHash : undefined,
    ),
    occurredAtLabel: occurredAt,
    isExternalGuest: securityContext.isExternalGuest === true,
  };
}

export { sanitizeAuditMetadataForDisplay as sanitizeTrackingMetadata } from '../../audit/utils/auditDisplay';
