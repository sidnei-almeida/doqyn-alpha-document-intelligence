import type { ExpiryAlertConfig } from '@/types/rules';

/**
 * Padrão sugerido: avisa um mês, uma semana e um dia antes. Constante em arquivo próprio para não
 * quebrar o fast refresh do componente que a consome — mesma convenção de `buttonVariants.ts`.
 */
export const DEFAULT_EXPIRY_ALERT_CONFIG: ExpiryAlertConfig = {
  enabled: false,
  offsetsDays: [30, 7, 1],
  notifyGroupIds: [],
  notifyAfterExpiry: false,
};
