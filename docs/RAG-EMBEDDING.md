# RAG documental — embedding e busca semântica

Como o vetor entra em `document_chunks`, quem consome, e o que ligar em produção.

## Dois caminhos, não dois modos

| Caminho | Quando | O que usa |
|---|---|---|
| Retrieval híbrido (`RETRIEVAL_MODE=hybrid`) | Durante a análise de um documento | Chunks em memória, scoring por regra/regex (`hybridChunkRetriever.ts`) |
| Busca semântica (`$vectorSearch`) | Pergunta sobre o acervo já gravado | `document_chunks` + índice do Atlas (`documentChunkVectorSearch.ts`) |

`RETRIEVAL_MODE` continua `hybrid` e **não deve** virar `atlas_vector`: aquele modo é o que
classifica e extrai metadado do documento em processamento. Trocá-lo quebraria a análise sem
melhorar a busca.

## Cadeia

```
confirm da versão
  → persistDocumentVersionChunks   (chunk com embedding: null)
  → enqueueEmbeddingJob            (fila document-embedding, jobId = documento + versão)
  → worker de análise              (runAnalysisWorker carrega o loop de embedding)
  → embedChunksMatching            (e5-base local, prefixo `passage:`, lote)
  → $vectorSearch                  (filtro de tenant dentro do estágio)
```

O embedding **nunca** roda no processo que responde o request: custa segundos por documento e
carrega ~280 MB de modelo. Sem Redis ou com `EMBEDDING_ENABLED=false`, o chunk simplesmente nasce
sem vetor — o upload continua rápido e a busca semântica fica atrasada até o backfill passar.

## Variáveis

| Variável | Padrão | Para que serve |
|---|---|---|
| `EMBEDDING_ENABLED` | `false` | Liga a fila. Desligada, nada é vetorizado automaticamente. |
| `EMBEDDING_MODEL` | `Xenova/multilingual-e5-base` | Trocar exige recriar o índice e regerar todos os vetores. |
| `EMBEDDING_DTYPE` | `q8` | `fp32` baixa ~1,1 GB e não cabe no VPS. |
| `EMBEDDING_CACHE_DIR` | `.cache/transformers` | Onde o ONNX fica em disco. Em produção é volume nomeado. |
| `EMBEDDING_BATCH_SIZE` | `8` | Chunks por lote de inferência. |
| `EMBEDDING_QUEUE_CONCURRENCY` | `1` | Jobs simultâneos. Inferência é CPU-bound e divide host com a análise. |
| `EMBEDDING_JOB_TTL_HOURS` | `24` | Retenção do job concluído no Redis. |

Ligar em produção pede também `DOQYN_WORKER_MEM_LIMIT=1.5g`: o ONNX soma ~300 MB fora do heap do
V8, e o limite padrão do `doqyn-worker` é 1g.

## Operação

```bash
# índice vetorial no Atlas
npx tsx scripts/atlas-vector-index.ts status
npx tsx scripts/atlas-vector-index.ts create

# vetorizar o que já está gravado
npx tsx scripts/rag-embed-backfill.ts --dry-run
npx tsx scripts/rag-embed-backfill.ts --tenant tenant_123 --limit 500

# provar a busca contra o Atlas, incluindo o isolamento por tenant
npx tsx scripts/rag-vector-search-smoke.ts "qual o prazo de vigencia?"

# cadeia inteira sobre um arquivo, sem tocar no banco
node scripts/rag-pdf-smoke.mjs contrato.pdf "qual o prazo de vigencia?"
```

## Armadilhas já pagas

**`$vectorSearch` ignora `$match` posterior.** Ele varre o índice e devolve os k vizinhos mais
próximos de todos os tenants; o `$match` depois só descarta linha de um ranking que já misturou
clientes. O recorte só existe com `tenantId` declarado como campo de filtro **dentro** da
definição do índice — e campo de filtro não se acrescenta depois, só recriando o índice. Por isso
`documentId` e `isCurrentVersion` já entram, antes de existir tela que os use.

**Prefixo assimétrico.** A família e5 exige `passage:` no trecho armazenado e `query:` na
pergunta. Sem isso a recuperação piora sem dar erro.

**Índice READY sobre corpo sem vetor não responde nada.** Chunk gravado antes do embedding
existir tem `embedding: null` e é invisível para a busca. É o que `rag-embed-backfill` resolve.

**Chunk vazio não vai ao modelo.** O vetor do prefixo `passage:` sozinho fica a distância média
de qualquer pergunta e polui o topo do ranking.

## Medições (base de desenvolvimento, 2026-08-15)

- carga do modelo: 638–1151ms quente; 275s na primeira vez, com download
- vetorização: 379ms por chunk em lote de 8
- busca: 146ms para 3 trechos, ordenação coerente em português
- isolamento: tenant inexistente recebe 0 trechos
