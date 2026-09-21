/**
 * Recuo progressivo com dispersão entre consultas de status da análise.
 *
 * Perguntar de 2 em 2 segundos para sempre multiplica requisição inútil justamente no processo que
 * está ocupado analisando — e com vários arquivos em voo isso vira um lote de requisições em
 * uníssono. As primeiras consultas continuam rápidas, porque é quando a resposta costuma chegar;
 * depois o intervalo cresce, e a dispersão evita que todos os arquivos batam no mesmo instante.
 *
 * Mora fora de `analyzePdf.ts` porque lá o módulo arrasta a sessão e o `fetch` autenticado; aqui é
 * aritmética pura, que o teste consegue chamar.
 *
 * Os números acompanham a vazão do provedor: com a análise levando ~6 s, começar em 2 s e crescer
 * até 10 s fazia o resultado pronto esperar até mais uma volta inteira na tela. Começa em 1 s e
 * para em 5 s.
 */
const FIRST_DELAY_MS = 1_000;
const GROWTH = 1.5;
const MAX_DELAY_MS = 5_000;
const JITTER_MS = 500;

export function analysisPollDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(FIRST_DELAY_MS * GROWTH ** Math.max(attempt - 1, 0), MAX_DELAY_MS);
  return Math.round(base + random() * JITTER_MS);
}
