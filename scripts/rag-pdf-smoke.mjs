// Ponta a ponta do RAG documental sobre um arquivo real, sem tocar no banco.
//
//   PDF ou imagem
//     -> extractTextFromDocument  (pdf-parse, com queda para Vision OCR se faltar texto)
//     -> createDocumentChunks     (1800 chars, 250 de sobreposicao)
//     -> embedPassages            (e5-base local, prefixo `passage:`)
//     -> embedQuery + cosseno     (prefixo `query:`)
//
// O ranking aqui e em memoria de proposito: prova a cadeia inteira sem depender do indice
// do Atlas ficar READY nem sujar `document_chunks` com dado de teste.
//
// Uso:
//   node scripts/rag-pdf-smoke.mjs <caminho.pdf> "pergunta em portugues"
import { readFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(REPO, '.env') });

const filePath = process.argv[2];
const question = process.argv[3] ?? 'Qual e o prazo de vigencia?';

if (!filePath) {
  console.error('Uso: node scripts/rag-pdf-smoke.mjs <caminho> "pergunta"');
  process.exit(1);
}

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};
const mimeType = MIME_BY_EXT[extname(filePath).toLowerCase()] ?? 'application/pdf';

const { extractTextFromDocument } = await import('../server/ai/services/documentTextExtractor.ts');
const { createDocumentChunks } = await import('../server/ai/services/documentChunker.ts');
const { embedPassages, embedQuery } = await import('../server/ai/embeddings/embeddingService.ts');

const buffer = readFileSync(filePath);
console.log(`arquivo: ${basename(filePath)} (${(buffer.length / 1024).toFixed(0)} KB, ${mimeType})`);

const extractStartedAt = Date.now();
const extracted = await extractTextFromDocument(buffer, mimeType);
console.log(
  `extracao: fonte=${extracted.source} · ${extracted.charCount} chars · ${extracted.pageCount ?? '?'} paginas · ` +
    `OCR tentado=${extracted.ocrAttempted} usado=${extracted.ocrFallbackUsed} · ${Date.now() - extractStartedAt}ms`,
);
if (extracted.ocrErrorCode) console.log(`ATENCAO erro de OCR: ${extracted.ocrErrorCode}`);

const chunks = createDocumentChunks(extracted);
console.log(`chunks: ${chunks.length}`);

if (!chunks.length) {
  console.error('Nenhum chunk gerado — nada a vetorizar.');
  process.exit(1);
}

const embedStartedAt = Date.now();
const vectors = await embedPassages(chunks.map((chunk) => chunk.text));
const embedMs = Date.now() - embedStartedAt;
console.log(
  `embeddings: ${vectors.length} vetores de ${vectors[0].length}d em ${embedMs}ms ` +
    `(${(embedMs / vectors.length).toFixed(0)}ms por chunk)`,
);

const query = await embedQuery(question);
const dot = (a, b) => a.reduce((acc, x, i) => acc + x * b[i], 0);

const ranked = chunks
  .map((chunk, i) => ({
    score: dot(query, vectors[i]),
    pagina: chunk.pageNumber,
    indice: chunk.chunkIndex,
    trecho: chunk.text.replace(/\s+/g, ' ').slice(0, 220),
  }))
  .sort((a, b) => b.score - a.score);

console.log(`\npergunta: ${JSON.stringify(question)}\ntop 3 trechos:\n`);
for (const hit of ranked.slice(0, 3)) {
  console.log(`  [${hit.score.toFixed(4)}] pagina ${hit.pagina}, chunk ${hit.indice}`);
  console.log(`  ${hit.trecho}...\n`);
}
