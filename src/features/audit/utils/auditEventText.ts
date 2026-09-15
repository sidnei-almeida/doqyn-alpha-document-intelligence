import type { TFunction } from 'i18next';
import { i18n } from '@/i18n';
import { AUDIT_ACTION_LABEL_KEYS } from '@/types/audit';

type AuditEventText = {
  action: string;
  description?: string;
  params?: Record<string, string | number | boolean>;
};

/**
 * O nome curto da ação, no idioma de quem lê.
 *
 * Quem chama passa um `t` que já carregou `auditEvents` (via `useTranslation`); sem isso a chave
 * não existe ainda e o rótulo cai no texto que o servidor mandou, até o catálogo chegar.
 */
export function auditEventLabel(t: TFunction, action: string, fallback: string): string {
  const legacyKey = AUDIT_ACTION_LABEL_KEYS[action];
  if (legacyKey) return String(t(legacyKey));
  const key = `auditEvents:${action}.label`;
  return i18n.exists(key) ? String(t(key)) : fallback;
}

/**
 * A frase do evento: relida pelo catálogo quando o evento tem `params`, e a gravada quando não tem.
 *
 * Evento antigo não tem `params` e continua em português — é o que ele é, e reescrever o passado
 * seria desonesto com a trilha. Evento gravado pelo catálogo se relê no idioma de quem abre.
 */
export function auditEventDescription(t: TFunction, event: AuditEventText): string {
  const stored = event.description ?? '';
  if (!event.params) return stored;
  const key = `auditEvents:${event.action}.description`;
  return i18n.exists(key) ? String(t(key, event.params)) : stored;
}
