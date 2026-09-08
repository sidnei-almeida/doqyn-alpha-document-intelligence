/**
 * Formatação amarrada ao idioma ativo, com `Intl` puro.
 *
 * Nenhuma biblioteca de data nova: `Intl` já está no runtime, conhece os três idiomas e não
 * cobra um pacote por locale. O que ele não faz sozinho é lembrar qual idioma está ativo — é
 * só isso que este módulo acrescenta.
 *
 * **Este é o ponto de entrada da Fase 4.** Hoje o app tem 35 pontos com `'pt-BR'` cravado
 * (datas, `localeCompare`, bytes); eles migram para cá um a um. Enquanto isso, código novo já
 * deve usar estas funções em vez de escrever o locale à mão.
 *
 * O fuso ainda vem do navegador. A Fase 2 traz `AuthUser.timeZone`, e é ele que passará a
 * mandar — hoje um evento de auditoria muda de dia conforme quem o abre.
 */
import { i18n } from './index';
import { DEFAULT_LOCALE } from './locales';

function activeLocale(): string {
  return i18n.language || DEFAULT_LOCALE;
}

/**
 * `Intl.*Format` é caro de construir e barato de reusar; a própria especificação recomenda
 * guardar a instância. Como a chave inclui o locale, trocar de idioma cria a sua e mantém as
 * outras — o custo é pago uma vez por combinação.
 */
const cache = new Map<string, unknown>();

function memo<T>(key: string, build: () => T): T {
  const cached = cache.get(key);
  if (cached) return cached as T;
  const created = build();
  cache.set(key, created);
  return created;
}

function dateTimeFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = activeLocale();
  return memo(`dt:${locale}:${JSON.stringify(options)}`, () =>
    new Intl.DateTimeFormat(locale, options),
  );
}

function toDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  const date = toDate(value);
  return date ? dateTimeFormat(options).format(date) : '';
}

export function formatDateTime(value: Date | string | number): string {
  return formatDate(value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Data por extenso — o formato do painel Detalhes e da trilha. */
export function formatLongDate(value: Date | string | number): string {
  return formatDate(value, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const locale = activeLocale();
  const formatter = memo(`n:${locale}:${JSON.stringify(options ?? {})}`, () =>
    new Intl.NumberFormat(locale, options),
  );
  return formatter.format(value);
}

const BYTE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'] as const;

/**
 * O separador decimal acompanha o idioma — `1,5 GB` em português e espanhol, `1.5 GB` em
 * inglês. A unidade não: `MB` é `MB` nos três, e traduzi-la seria inventar um problema.
 */
export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${BYTE_UNITS[0]}`;

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const digits = unit === 0 ? 0 : fractionDigits;
  return `${formatNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${BYTE_UNITS[unit]}`;
}

const RELATIVE_STEPS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
];

export function formatRelativeTime(value: Date | string | number, from: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return '';

  const locale = activeLocale();
  const formatter = memo(`rt:${locale}`, () =>
    new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
  );

  const diff = date.getTime() - from.getTime();
  for (const step of RELATIVE_STEPS) {
    if (Math.abs(diff) >= step.ms) {
      return formatter.format(Math.round(diff / step.ms), step.unit);
    }
  }
  return formatter.format(Math.round(diff / 1000), 'second');
}

/** "a, b e c" em português; "a, b, and c" em inglês. Concatenar com vírgula não faz isso. */
export function formatList(items: string[], type: Intl.ListFormatType = 'conjunction'): string {
  const locale = activeLocale();
  const formatter = memo(`l:${locale}:${type}`, () => new Intl.ListFormat(locale, { type }));
  return formatter.format(items);
}

/**
 * Comparação de texto pelas regras do idioma, não por ordem de byte.
 *
 * É o que faz `Ávila` vir antes de `Zebra` e `ñ` cair onde o espanhol espera. `sensitivity:
 * 'base'` ignora acento e caixa na comparação, que é o comportamento que uma lista de nomes
 * precisa. A ordenação equivalente do lado do Mongo é a Fase 5.
 */
export function compareText(a: string, b: string): number {
  const locale = activeLocale();
  const collator = memo(`c:${locale}`, () =>
    new Intl.Collator(locale, { sensitivity: 'base', numeric: true }),
  );
  return collator.compare(a, b);
}
