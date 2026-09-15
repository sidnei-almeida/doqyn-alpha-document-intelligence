/**
 * O fuso do perfil, e a regra de quando ele vale.
 *
 * **Instante** — timestamp, `Date`, número — é lido no fuso de quem olha. Sem isso um evento de
 * auditoria às 23h em São Paulo aparecia no dia seguinte para quem abre o app de um navegador em
 * Lisboa, e dois auditores discordavam sobre o dia do mesmo fato.
 *
 * **Data de calendário** — `yyyy-mm-dd`, como vencimento e prazo — não tem fuso: dia 15 é dia 15
 * em qualquer lugar. É lida em UTC e formatada em UTC. Aplicar o fuso nela mudaria o dia, e é o
 * mesmo defeito que `new Date('2026-08-24')` já causava sozinho: vira dia 23 no Brasil.
 *
 * Sem dependência de propósito: `lib/utils` e `i18n/formats` importam daqui, e nenhum dos dois
 * pode ser importado de volta.
 */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

let profileTimeZone: string | undefined;
let lastRawValue: string | null | undefined;

export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fuso inválido ou ausente cai no do navegador, em silêncio: é o comportamento de antes, e uma
 * coluna mal preenchida no perfil não pode derrubar toda data da tela.
 */
export function setProfileTimeZone(value: string | null | undefined): void {
  if (value === lastRawValue) return;
  lastRawValue = value;
  profileTimeZone = isValidTimeZone(value) ? value : undefined;
}

export function getProfileTimeZone(): string | undefined {
  return profileTimeZone;
}

export type DateInput = Date | string | number;

/** O instante a formatar e o fuso em que ele deve ser lido; `null` quando não é data. */
export function resolveDateInput(
  value: DateInput,
): { date: Date; timeZone: string | undefined } | null {
  if (typeof value === 'string' && CALENDAR_DATE.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : { date, timeZone: 'UTC' };
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : { date, timeZone: profileTimeZone };
}
