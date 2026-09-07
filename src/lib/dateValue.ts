/** Data em `yyyy-mm-dd` — o formato que os filtros e a API trocam entre si. */

/** `yyyy-mm-dd` sem passar por `toISOString()`, que desloca o dia pelo fuso. */
export function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Interpreta `yyyy-mm-dd` no fuso local — `new Date('2026-08-24')` vira 23 no Brasil. */
export function parseIsoDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}
