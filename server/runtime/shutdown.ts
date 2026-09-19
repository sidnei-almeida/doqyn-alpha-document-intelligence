import { logger } from '../utils/logger.js';
import { closeRedis } from '../redis/redisClient.js';
import { closeMongoConnection } from '../db/mongoClient.js';

/**
 * Desligamento gracioso e rede de segurança para o processo inteiro.
 *
 * Nem a API nem os workers ouviam SIGTERM: o Docker mandava o sinal, o Node ignorava, e dez
 * segundos depois vinha o SIGKILL no meio do que estivesse acontecendo — requisição pela metade,
 * job de análise sem devolver a vaga, conexão do Mongo cortada. `closeRedis` e
 * `closeMongoConnection` existiam e só eram chamados por um script de manutenção.
 *
 * Também não havia `uncaughtException` nem `unhandledRejection`: a promessa rejeitada sem dono
 * derrubava o processo com o rastro padrão do Node, sem passar pelo log estruturado.
 */

type Closer = { name: string; close: () => Promise<unknown> | unknown };

const closers: Closer[] = [];
let shuttingDown = false;

/** Registra algo para fechar antes de o processo sair. Fecham na ordem inversa do registro. */
export function onShutdown(name: string, close: Closer['close']): void {
  closers.push({ name, close });
}

function resolveTimeoutMs(): number {
  const raw = Number(process.env.SHUTDOWN_TIMEOUT_MS);
  // Abaixo dos 10 s que o Docker espera antes do SIGKILL, para o log do fim caber na janela.
  return Number.isFinite(raw) && raw > 0 ? raw : 8_000;
}

async function runClosers(): Promise<void> {
  for (const closer of [...closers].reverse()) {
    try {
      await closer.close();
    } catch (error) {
      logger.warn('shutdown: falha ao fechar recurso', {
        resource: closer.name,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
  await closeRedis().catch(() => undefined);
  await closeMongoConnection().catch(() => undefined);
}

export async function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('desligando', { reason });

  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), resolveTimeoutMs()).unref(),
  );
  const result = await Promise.race([runClosers().then(() => 'done' as const), timeout]);
  if (result === 'timeout') {
    logger.warn('shutdown: prazo esgotado, saindo assim mesmo', { reason });
  }

  process.exit(exitCode);
}

/**
 * Liga os sinais e os dois eventos de erro do processo. Chamar uma vez, no ponto de entrada.
 *
 * `unhandledRejection` não derruba: no Node 15+ o padrão é matar o processo, e uma promessa solta
 * num caminho lateral tiraria a API do ar inteira. Fica no log, com o rastro.
 *
 * `uncaughtException` derruba, depois de fechar o que dá: dali em diante o estado do processo é
 * desconhecido, e é melhor o Docker subir um novo do que seguir servindo às cegas.
 */
export function installProcessGuards(processName: string): void {
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('promessa rejeitada sem tratamento', {
      process: processName,
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('exceção não tratada', {
      process: processName,
      message: error.message,
      stack: error.stack,
    });
    void shutdown('uncaughtException', 1);
  });
}
