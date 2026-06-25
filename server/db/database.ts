/**
 * Nome do database MongoDB — fonte única de verdade do projeto.
 *
 * Variável principal: MONGODB_DATABASE
 * Fallback temporário: doqyn_dev
 *
 * MONGODB_DB_NAME (legado) não deve ser usado pelo código da aplicação.
 */
export const DEFAULT_MONGODB_DATABASE = 'doqyn_dev';

export function getMongoDatabaseName(): string {
  const configured = process.env.MONGODB_DATABASE?.trim();
  if (configured) {
    return configured;
  }

  return DEFAULT_MONGODB_DATABASE;
}
