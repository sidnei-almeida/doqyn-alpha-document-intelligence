import i18next from 'i18next';
import ptAuditEvents from '../../src/i18n/catalog/pt-BR/auditEvents.json' with { type: 'json' };
import enAuditEvents from '../../src/i18n/catalog/en-US/auditEvents.json' with { type: 'json' };
import esAuditEvents from '../../src/i18n/catalog/es-419/auditEvents.json' with { type: 'json' };
import ptNotifications from '../../src/i18n/catalog/pt-BR/notifications.json' with { type: 'json' };
import enNotifications from '../../src/i18n/catalog/en-US/notifications.json' with { type: 'json' };
import esNotifications from '../../src/i18n/catalog/es-419/notifications.json' with { type: 'json' };
import ptEmail from '../../src/i18n/catalog/pt-BR/email.json' with { type: 'json' };
import enEmail from '../../src/i18n/catalog/en-US/email.json' with { type: 'json' };
import esEmail from '../../src/i18n/catalog/es-419/email.json' with { type: 'json' };
import {
  renderNotificationText as renderNotificationTextWith,
  type NotificationParams,
  type NotificationText,
} from '../../shared/notificationText.js';
import { foldSearchText } from '../utils/documentListQuery.js';

/**
 * Tradução do lado do servidor, sem React.
 *
 * Instância própria do i18next, com os catálogos carregados na subida: são pequenos, e o caminho
 * que usa isto grava trilha de auditoria — não é lugar para um `import()` sob demanda falhar.
 *
 * O catálogo é **o mesmo arquivo** que o front lê em `src/i18n/catalog`. Duas cópias
 * divergiriam: a frase gravada no evento diria uma coisa e a tela, relendo pela chave, outra.
 */
export const SERVER_LOCALES = ['pt-BR', 'en-US', 'es-419'] as const;
export type ServerLocale = (typeof SERVER_LOCALES)[number];
export const SERVER_DEFAULT_LOCALE: ServerLocale = 'pt-BR';

const RESOURCES = {
  'pt-BR': { auditEvents: ptAuditEvents, notifications: ptNotifications, email: ptEmail },
  'en-US': { auditEvents: enAuditEvents, notifications: enNotifications, email: enEmail },
  'es-419': { auditEvents: esAuditEvents, notifications: esNotifications, email: esEmail },
};

export type ServerNamespace = keyof (typeof RESOURCES)['pt-BR'];

const instance = i18next.createInstance();
void instance.init({
  resources: RESOURCES,
  lng: SERVER_DEFAULT_LOCALE,
  fallbackLng: SERVER_DEFAULT_LOCALE,
  supportedLngs: [...SERVER_LOCALES],
  ns: ['auditEvents', 'notifications', 'email'],
  defaultNS: 'auditEvents',
  interpolation: { escapeValue: false },
  initAsync: false,
});

export function normalizeServerLocale(value: string | null | undefined): ServerLocale {
  if (!value) return SERVER_DEFAULT_LOCALE;
  const tag = value.trim().replace('_', '-');
  if ((SERVER_LOCALES as readonly string[]).includes(tag)) return tag as ServerLocale;
  const primary = tag.split('-')[0]?.toLowerCase();
  if (primary === 'en') return 'en-US';
  if (primary === 'es') return 'es-419';
  return SERVER_DEFAULT_LOCALE;
}

export type AuditTextKind = 'label' | 'description';

/** `context` escolhe a variante (`description_batch`); o resto interpola a frase. */
export type AuditMessageParams = Record<string, string | number | boolean>;

/**
 * A frase de uma ação de auditoria, no idioma pedido; `undefined` quando o catálogo não a tem.
 *
 * A ação é a chave: `document.moved` lê `document.moved.description`. Quem pergunta decide o que
 * fazer com a ausência — a gravação cai na descrição recebida, a leitura no texto já gravado.
 */
export function renderAuditText(
  locale: string | null | undefined,
  action: string,
  kind: AuditTextKind,
  params?: AuditMessageParams,
): string | undefined {
  const key = `${action}.${kind}`;
  if (!instance.exists(key, { lng: SERVER_DEFAULT_LOCALE })) return undefined;
  return String(instance.t(key, { ...(params ?? {}), lng: normalizeServerLocale(locale) }));
}

/** Um `t` preso ao idioma e ao namespace — para quem monta texto inteiro, como o e-mail. */
export function getServerT(
  locale: string | null | undefined,
  ns: ServerNamespace,
): (key: string, values?: Record<string, unknown>) => string {
  const t = instance.getFixedT(normalizeServerLocale(locale), ns);
  return (key, values) => String(t(key, values ?? {}));
}

/**
 * Título e corpo de uma notificação in-app, no idioma pedido.
 *
 * A montagem é a mesma que a tela usa (`shared/notificationText.ts`); aqui só se fornece o `t` e o
 * formato de data do idioma.
 */
export function renderNotificationText(
  locale: string | null | undefined,
  type: string,
  params: NotificationParams,
): NotificationText | undefined {
  const lng = normalizeServerLocale(locale);
  const t = instance.getFixedT(lng, 'notifications');
  const dateFormat = new Intl.DateTimeFormat(lng, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return renderNotificationTextWith(type, params, {
    t: (key, values) => String(t(key, values ?? {})),
    formatCalendarDate: (value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
    },
  });
}

let searchIndex: Array<{ action: string; texts: string[] }> | null = null;

function collectAuditTexts(node: unknown, path: string[], into: Map<string, string[]>): void {
  if (typeof node === 'string') {
    const kind = path[path.length - 1] ?? '';
    if (!/^(label|description)(_\w+)?$/.test(kind)) return;
    const action = path.slice(0, -1).join('.');
    const text = foldSearchText(node.replace(/\{\{[^}]+\}\}/g, ' '));
    into.set(action, [...(into.get(action) ?? []), text]);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      collectAuditTexts(value, [...path, key], into);
    }
  }
}

/**
 * As ações cujo rótulo ou frase contém o termo, em **qualquer** dos três idiomas.
 *
 * A descrição fica gravada no idioma de quem agiu. Buscar só nela faria o auditor em espanhol não
 * achar o evento gravado em português — então a busca também procura pela ação, casando o termo
 * contra o catálogo inteiro.
 */
export function findAuditActionsMatching(term: string): string[] {
  const folded = foldSearchText(term.trim());
  if (folded.length < 3) return [];

  if (!searchIndex) {
    const texts = new Map<string, string[]>();
    for (const locale of SERVER_LOCALES) {
      collectAuditTexts(RESOURCES[locale].auditEvents, [], texts);
    }
    searchIndex = [...texts].map(([action, entries]) => ({ action, texts: entries }));
  }

  return searchIndex
    .filter((entry) => entry.texts.some((text) => text.includes(folded)))
    .map((entry) => entry.action);
}
