import 'dotenv/config';
import { DEFAULT_MONGODB_DATABASE, getMongoDatabaseName } from '../../server/db/database.js';

/**
 * Guarda de banco de teste (D-17).
 *
 * A suíte de integração planta e apaga documentos. Rodar contra o database de aplicação apagaria
 * dado real, então a suíte recusa executar quando o nome do database não casa com o padrão de
 * teste. A variável correta é `MONGODB_DATABASE` — `MONGODB_DB` não é lida por este código e
 * apontaria a suíte para o banco real em silêncio.
 *
 * Mora em `tests/` de propósito: código de produção não conhece nome de banco de teste.
 */
export const TEST_DB_PATTERN = /(^|_)test(_|$)/;

export function assertTestDatabase(): void {
  const name = getMongoDatabaseName();

  // O segundo termo é cinto e suspensório: se um dia `DEFAULT_MONGODB_DATABASE` for renomeado para
  // algo que case com o padrão, o fallback silencioso volta a passar pela guarda.
  if (!TEST_DB_PATTERN.test(name) || name === DEFAULT_MONGODB_DATABASE) {
    throw new Error(
      `Recusando executar: MONGODB_DATABASE="${name}" não casa com o padrão de teste. ` +
        'Defina MONGODB_DATABASE=doqyn_test antes de rodar a suíte de integração.',
    );
  }
}
