import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { i18n } from '@/i18n';
import { formatNumber } from '@/i18n/formats';
import { DEFAULT_LOCALE } from '@/i18n/locales';
import { getProfileTimeZone, resolveDateInput } from '@/i18n/timeZone';

/**
 * Os degraus da escala tipográfica do DOQYN, declarados para o `tailwind-merge`.
 *
 * Sem isto ele não tem como saber que `text-label` é **tamanho** e `text-doqyn-muted` é **cor**:
 * ambos começam com `text-`, caem no mesmo grupo, e o último vence. Como o tamanho vem do
 * `size` da `cva` — depois do `variant` —, a cor declarada na variante era descartada em
 * silêncio, e todo botão do app ficava herdando a cor do pai.
 *
 * No tema escuro isso passou despercebido porque o herdado é claro sobre fundo escuro. No claro,
 * o botão principal ficava com texto quase preto sobre o verdigris preenchido.
 */
const FONT_SIZES = ['eyebrow', 'display', 'h1', 'h2', 'body', 'label', 'caption', 'micro'] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...FONT_SIZES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function activeLocale(): string {
  return i18n.language || DEFAULT_LOCALE;
}

/**
 * Composição manual em vez de deixar o Intl montar a frase: em pt-BR o formato
 * `month: 'short'` devolve "16 de ago de 2026", e os "de" ocupam espaço numa
 * coluna de tabela sem acrescentar informação.
 *
 * Só o português precisa disso. Inglês e espanhol já saem enxutos do Intl — `Aug 16, 2026`,
 * `16 ago 2026` —, e compor à mão neles trocaria a ordem que o leitor espera.
 */
/**
 * Valor inválido segue para o `Intl` como antes, e estoura lá: trocar por string vazia aqui
 * esconderia do chamador um dado quebrado que ele hoje vê.
 */
function resolveForFormat(date: string | Date) {
  return resolveDateInput(date) ?? { date: new Date(date), timeZone: getProfileTimeZone() };
}

function dateParts(date: string | Date, locale: string) {
  const resolved = resolveForFormat(date);
  const parts = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: resolved.timeZone,
  }).formatToParts(resolved.date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    day: get('day'),
    month: get('month').replace('.', ''),
    year: get('year'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

/**
 * Data por extenso abreviada — `16 ago 2026`.
 *
 * Numeral puro é ambíguo em documento que cruza fronteira: 03/08 é março ou
 * agosto dependendo de quem lê, e num contrato essa ambiguidade custa caro. O
 * mês por extenso remove a dúvida sem ocupar muito mais espaço.
 *
 * Use em qualquer lugar onde a hora não muda a decisão: lista de documentos,
 * vigência, data de assinatura.
 */
export function formatDate(date: string | Date): string {
  const locale = activeLocale();
  if (!locale.startsWith('pt')) {
    const resolved = resolveForFormat(date);
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: resolved.timeZone,
    }).format(resolved.date);
  }
  const { day, month, year } = dateParts(date, locale);
  return `${day} ${month} ${year}`;
}

/**
 * Data com hora — `16 ago 2026, 21:03`.
 *
 * Só onde o instante exato é o dado: auditoria, tracking, aprovações, histórico
 * de versão e eventos de assinatura. Numa lista de documentos a hora é ruído,
 * e empurra para fora da coluna o que de fato importa.
 */
export function formatDateTime(date: string | Date): string {
  const locale = activeLocale();
  if (!locale.startsWith('pt')) {
    const resolved = resolveForFormat(date);
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: resolved.timeZone,
    }).format(resolved.date);
  }
  const { day, month, year, hour, minute } = dateParts(date, locale);
  return `${day} ${month} ${year}, ${hour}:${minute}`;
}

/** `toFixed` escreve ponto em qualquer idioma — `1.5 MB` em português. O separador é do locale. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${formatNumber(bytes / Math.pow(k, i), { maximumFractionDigits: 1 })} ${sizes[i]}`;
}
