import 'dotenv/config';

/**
 * Desliga o Redis para a suíte inteira, no momento do import.
 *
 * `applyTestEnv()` em `integrationApi.ts` já fazia isso — mas só quando `bootTestApi()` era
 * chamado, e todo arquivo de integração planta fixture **antes** de subir a API. A primeira
 * fixture chama `invalidateTenantRegistryCache`, que fala com o Redis, que nesse instante ainda
 * enxerga o `.env` de desenvolvimento. O cliente nasce, fica guardado em `global._doqynRedisCache`
 * e nunca mais é consultado sobre estar ligado ou não: desligar a variável depois não desconecta
 * nada.
 *
 * O efeito é um socket aberto que segura o event loop depois do último teste passar. O arquivo
 * termina a bateria inteira em verde e o processo não morre — e **só numa máquina que tenha Redis
 * de pé**, o que explica por que isto aparecia para uns e não para outros.
 *
 * Por isso mora aqui, num módulo que os dois helpers importam antes de qualquer coisa acontecer, e
 * não dentro de uma função que alguém precisa lembrar de chamar na hora certa.
 *
 * Um teste que precise do Redis ligado sobrescreve `REDIS_ENABLED` no próprio teste e restaura
 * depois — é o que `tenant-registry-cache` e `phase-a-health` já fazem.
 */
process.env.REDIS_ENABLED = 'false';
process.env.SESSION_CACHE_ENABLED = 'false';
delete process.env.REDIS_URL;

/** No-op nomeado: existe para o import ficar legível na lista, em vez de parecer sobra. */
export function ensureTestEnv(): void {}
