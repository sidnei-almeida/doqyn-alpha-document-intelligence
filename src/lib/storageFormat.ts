/**
 * Como se escreve o tamanho de um acervo.
 *
 * O `formatFileSize` de upload não serve aqui: ele para em MB porque mede um arquivo por
 * vez, e o acervo de um espaço passa de mil megabytes sem esforço. A precisão também cai
 * conforme a unidade sobe — 940 KB e 1,2 GB pedem casas diferentes para caber no mesmo
 * espaço sem virar ruído.
 *
 * Nasceu dentro de `SidebarUsage` e saiu de lá quando Configurações passou a mostrar o
 * mesmo dado: dois formatadores para o mesmo número acabariam divergindo na primeira vez
 * que alguém ajustasse as casas de um deles.
 */

function formatNumber(value: number, digits: number, minDigits = digits): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: digits,
  });
}

export function formatStorageSize(bytes: number): string {
  if (bytes <= 0) return '0 KB';

  const kb = bytes / 1024;
  if (kb < 1024) return `${formatNumber(kb, kb < 10 ? 1 : 0)} KB`;

  const mb = kb / 1024;
  if (mb < 1024) return `${formatNumber(mb, mb < 10 ? 1 : 0)} MB`;

  // Em GB as casas são teto, não piso: o teto do plano é redondo ("10 GB"), e escrevê-lo
  // como "10,00 GB" faz um número exato parecer medição.
  return `${formatNumber(mb / 1024, 2, 0)} GB`;
}

export function formatStoragePercent(ratio: number): string {
  const percent = ratio * 100;
  // Abaixo de 1% arredondar para zero apagaria o dado; uma casa mantém o sinal.
  const digits = percent > 0 && percent < 1 ? 1 : 0;
  return `${formatNumber(percent, digits)}%`;
}

/** Acima disto a régua troca de tinta: o número deixa de ser informação e vira aviso. */
export const STORAGE_WARN_RATIO = 0.8;
export const STORAGE_DANGER_RATIO = 0.95;

export type StorageLevel = 'none' | 'ok' | 'warn' | 'danger';

export function storageLevel(ratio: number | null): StorageLevel {
  if (ratio === null) return 'none';
  if (ratio >= STORAGE_DANGER_RATIO) return 'danger';
  if (ratio >= STORAGE_WARN_RATIO) return 'warn';
  return 'ok';
}

/** `null` quando não há cota: sem teto não há proporção a desenhar, e a régua some. */
export function storageRatio(totalBytes: number, quotaBytes: number | null): number | null {
  if (!quotaBytes || quotaBytes <= 0) return null;
  return Math.min(totalBytes / quotaBytes, 1);
}
