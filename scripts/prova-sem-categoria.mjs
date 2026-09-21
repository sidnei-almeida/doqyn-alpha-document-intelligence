#!/usr/bin/env node
/**
 * Prova, com chamada real ao modelo, que "Sem categoria" parou de ser resposta.
 *
 *   npx tsx scripts/prova-sem-categoria.mjs [caminho-do-pdf]
 *
 * Roda o classificador duas vezes sobre o mesmo documento: uma com a pasta de sistema na lista
 * (o comportamento de antes) e outra sem ela (o de agora). Na segunda, quando nenhuma pasta
 * serve, pede a proposta de categoria nova.
 *
 * Não sobe Mongo nem tenant: o que está em julgamento é o que o modelo faz com a lista de
 * classes que recebe, e é isso — e só isso — que o script varia. Duas a três chamadas à Groq.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const { extractTextFromDocument } = await import(
  join(ROOT, 'server/ai/services/documentTextExtractor.ts')
);
const { createDocumentChunks } = await import(join(ROOT, 'server/ai/services/documentChunker.ts'));
const { selectChunksForClassification } = await import(
  join(ROOT, 'server/services/retrievalProvider.ts')
);
const { classifyDocumentWithRules } = await import(
  join(ROOT, 'server/ai/services/documentClassifierAgent.ts')
);
const { suggestCategoryForDocument } = await import(
  join(ROOT, 'server/ai/services/categorySuggestionAgent.ts')
);
const { isUncategorizedCategory, UNCATEGORIZED_CATEGORY_NAME } = await import(
  join(ROOT, 'shared/systemCategory.ts')
);

const alvo =
  process.argv[2] ||
  join(ROOT, 'synthetic_document_dataset/pdf/06_boleto_sintético.pdf');

/**
 * Um tenant plausível que NÃO tem pasta para o documento de teste.
 *
 * É a situação real relatada: a empresa cadastrou o que usa todo dia e mandou um documento de
 * outro tipo. A pasta de sistema está aqui porque ela está no tenant de verdade — o ponto do
 * teste é justamente o que acontece com ela na lista.
 */
const PASTAS_DO_TENANT = [
  {
    id: 'cat_contratos',
    name: 'Contratos',
    description: 'Contratos de prestação de serviço, acordos e aditivos entre a empresa e terceiros.',
    keywords: ['contrato', 'cláusula', 'contratante', 'contratada', 'aditivo'],
    fields: [],
    namingTemplate: '{titulo}',
  },
  {
    id: 'cat_rh',
    name: 'Recursos Humanos',
    description: 'Documentos de pessoal: admissão, férias, folha e desligamento.',
    keywords: ['funcionário', 'admissão', 'folha', 'férias', 'rescisão'],
    fields: [],
    namingTemplate: '{titulo}',
  },
  {
    id: 'cat_sem_categoria',
    name: UNCATEGORIZED_CATEGORY_NAME,
    description:
      'Documentos que chegaram sem classificação. Reclassifique quando souber onde eles moram.',
    keywords: [],
    fields: [],
    namingTemplate: '{titulo}',
  },
];

const classificaveis = PASTAS_DO_TENANT.filter(
  (pasta) => !isUncategorizedCategory({ id: pasta.id, name: pasta.name }),
);

function linha(texto = '') {
  console.log(texto);
}

async function classificar(rotulo, classes, chunks) {
  const resultado = await classifyDocumentWithRules({
    chunks,
    classes,
    context: { jobId: `prova_${rotulo}`, companyId: 'prova' },
  });

  linha(`  classe .......... ${resultado.className ?? '— (nenhuma)'}`);
  linha(`  confiança ....... ${resultado.confidence}`);
  linha(`  tipo lido ....... ${resultado.documentType ?? '—'}`);
  linha(`  motivo .......... ${(resultado.reason || '—').slice(0, 140)}`);

  return resultado;
}

const buffer = await readFile(alvo);
linha(`Documento: ${basename(alvo)}`);
linha();

const extraido = await extractTextFromDocument(buffer, 'application/pdf');
linha(`Texto extraído: ${extraido.charCount} caracteres, ${extraido.pageCount ?? '?'} página(s)`);

const chunks = createDocumentChunks(extraido);
const trechosAntes = selectChunksForClassification({ chunks, classes: PASTAS_DO_TENANT });
const trechosDepois = selectChunksForClassification({ chunks, classes: classificaveis });

linha();
linha('─── ANTES — a pasta de sistema na lista (3 opções) ───');
const antes = await classificar('antes', PASTAS_DO_TENANT, trechosAntes);

linha();
linha('─── DEPOIS — a pasta de sistema fora (2 opções) ───');
const depois = await classificar('depois', classificaveis, trechosDepois);

let proposta = null;
if (!depois.classId) {
  linha();
  linha('─── Nenhuma pasta serve: pedindo a proposta ───');
  const saida = await suggestCategoryForDocument({
    chunks: trechosDepois,
    classes: classificaveis,
    classification: depois,
    context: { jobId: 'prova_proposta', companyId: 'prova' },
  });
  proposta = saida.suggestion;

  if (proposta) {
    linha(`  nome ............ ${proposta.name}`);
    linha(`  descrição ....... ${proposta.description}`);
    linha(`  palavras-chave .. ${proposta.keywords.join(', ') || '—'}`);
    linha(`  motivo .......... ${proposta.reason}`);
  } else {
    linha('  o modelo não devolveu proposta aproveitável.');
  }
}

linha();
linha('═══ VEREDITO ═══');

const caiuNoDeposito = Boolean(
  antes.classId && isUncategorizedCategory({ id: antes.classId, name: antes.className }),
);
linha(
  caiuNoDeposito
    ? '  ANTES: caiu em "Sem categoria" — o defeito relatado, reproduzido.'
    : `  ANTES: foi para "${antes.className ?? 'nenhuma'}".`,
);

const depoisCaiuNoDeposito = Boolean(
  depois.classId && isUncategorizedCategory({ id: depois.classId, name: depois.className }),
);

if (depoisCaiuNoDeposito) {
  linha('  DEPOIS: ainda caiu no depósito — a filtragem não pegou. FALHOU.');
  process.exit(1);
}

if (depois.classId) {
  linha(`  DEPOIS: foi para "${depois.className}" — uma pasta de verdade.`);
} else if (proposta) {
  linha(`  DEPOIS: nenhuma pasta serve, e a IA propõe criar "${proposta.name}".`);
} else {
  linha('  DEPOIS: nenhuma pasta serve e não houve proposta — o documento fica para revisão.');
}
