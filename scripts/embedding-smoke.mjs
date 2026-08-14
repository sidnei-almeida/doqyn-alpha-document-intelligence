// Prova viva do embedding local: baixa o modelo (primeira vez), vetoriza trechos e
// confere dimensão, normalização e ordenação semântica.
//
// O teste que importa é o último: uma pergunta em português tem de ficar mais perto
// do trecho que a responde do que de um trecho de assunto diferente. Dimensão certa
// com ordenação errada é o modo de falha silencioso da família e5 quando o prefixo
// `query:`/`passage:` é esquecido.
//
// Uso: node scripts/embedding-smoke.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(REPO, '.env') });

const { embedPassages, embedQuery } = await import('../server/ai/embeddings/embeddingService.ts');
const { EMBEDDING_DIMENSIONS, getEmbeddingModel } = await import(
  '../server/ai/embeddings/embeddingConfig.ts'
);

const passages = [
  'O prazo de vigência deste contrato é de 24 meses, contados da data de assinatura.',
  'A parte reveladora não será responsabilizada por informações já de domínio público.',
  'O bolo de fubá leva milho, leite e erva-doce, e assa por quarenta minutos.',
];

console.log('modelo:', getEmbeddingModel());

const startedAt = Date.now();
const vectors = await embedPassages(passages);
const loadAndEmbedMs = Date.now() - startedAt;

const dims = vectors.map((v) => v.length);
const norms = vectors.map((v) => Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)));

console.log(`dimensoes: ${dims.join(', ')} (esperado ${EMBEDDING_DIMENSIONS})`);
console.log(`normas: ${norms.map((n) => n.toFixed(4)).join(', ')} (esperado ~1.0)`);
console.log(`carga + 3 passagens: ${loadAndEmbedMs}ms`);

const queryStartedAt = Date.now();
const query = await embedQuery('Quanto tempo dura o contrato?');
console.log(`consulta: ${Date.now() - queryStartedAt}ms`);

const dot = (a, b) => a.reduce((acc, x, i) => acc + x * b[i], 0);
const scores = vectors.map((v, i) => ({ trecho: passages[i].slice(0, 48) + '...', score: dot(query, v) }));
scores.sort((a, b) => b.score - a.score);

console.log('\nordenacao por similaridade com "Quanto tempo dura o contrato?":');
for (const { trecho, score } of scores) console.log(`  ${score.toFixed(4)}  ${trecho}`);

const dimsOk = dims.every((d) => d === EMBEDDING_DIMENSIONS);
const normsOk = norms.every((n) => Math.abs(n - 1) < 0.01);
const rankOk = scores[0].trecho.startsWith('O prazo de vigência');
const bakeryLast = scores[scores.length - 1].trecho.startsWith('O bolo de fubá');

console.log('');
console.log(dimsOk ? 'OK dimensao' : 'FALHOU dimensao');
console.log(normsOk ? 'OK normalizacao' : 'FALHOU normalizacao');
console.log(rankOk ? 'OK trecho do prazo ficou em primeiro' : 'FALHOU ordenacao semantica');
console.log(bakeryLast ? 'OK receita de bolo ficou em ultimo' : 'FALHOU separacao de assunto');

process.exit(dimsOk && normsOk && rankOk && bakeryLast ? 0 : 1);
