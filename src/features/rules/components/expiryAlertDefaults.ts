import type { ExpiryAlertConfig } from '@/types/rules';

/**
 * Padrão sugerido: um mês, uma semana e um dia antes, no dia do vencimento, e depois em 1, 3, 7,
 * 15 e 30 dias.
 *
 * Precisa ser o mesmo conjunto de `DEFAULT_EXPIRY_OFFSETS_DAYS` no servidor
 * (`server/services/expiry/documentExpiryAlertService.ts`). Se divergirem, a tela oferece uma
 * antecedência que a varredura não aplica.
 *
 * Constante em arquivo próprio para não quebrar o fast refresh do componente que a consome —
 * mesma convenção de `buttonVariants.ts`.
 */
export const DEFAULT_EXPIRY_ALERT_CONFIG: ExpiryAlertConfig = {
  enabled: true,
  offsetsDays: [30, 7, 1, 0, -1, -3, -7, -15, -30],
  notifyGroupIds: [],
  notifyAfterExpiry: true,
};
