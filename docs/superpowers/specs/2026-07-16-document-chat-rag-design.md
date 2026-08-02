# Chat com Documentos (RAG via Groq) — Design

**Data:** 2026-07-16
**Status:** Aprovado pelo usuário (brainstorming concluído)

## Objetivo

Permitir que o usuário converse com um documento da sua biblioteca usando a API Groq já
configurada no app. Duas portas de entrada: item "Conversar com IA" no menu de contexto
(botão direito) dos documentos, e uma seção dedicada com seletor de documento.

## Decisões (travadas em brainstorming)

| Decisão | Escolha |
|---|---|
| Escopo da conversa | 1 documento por conversa |
| Persistência | Efêmera — histórico vive só no estado do cliente durante a sessão |
| Entrada via botão direito | Drawer lateral sobre a biblioteca, sem navegar |
| Seção dedicada | Rota `/chat`, item na sidebar, seletor de documento + mesmo painel de chat |
| Retrieval | Contexto cheio (doc inteiro no prompt) com fallback léxico top-K para docs grandes; **sem banco vetorial na v1** |
| Streaming | Não na v1 — resposta JSON simples |

**Racional do retrieval:** a API Groq não oferece embeddings; o llama-4-scout tem janela de
131k tokens (≈460k chars, cf. `server/ai/utils/aiConfig.ts`), então um documento único quase
sempre cabe inteiro no contexto. Para os que não cabem, o retriever léxico híbrido já existente
(`server/services/hybridChunkRetriever.ts`) seleciona os chunks mais relevantes à pergunta.
O enum `RetrievalMode` (`hybrid | faiss | atlas_vector | google`) em
`server/services/retrievalProvider.ts` fica como porta plugável para vetorial quando
multi-doc entrar no roadmap.

## Infra existente reaproveitada

- **Chunks já persistidos**: `MongoDocumentChunk` (texto, `chunkIndex`, `pageNumber`, campo
  `embedding` reservado) gravados por `persistDocumentVersionChunks` durante a análise.
- **Consulta de chunks**: `queryDocumentChunksForRag` em `server/services/documentChunkService.ts`.
- **Scoring léxico**: `retrieveChunksForField`/`formatChunksForPrompt` em `hybridChunkRetriever.ts`.
- **Cliente Groq**: `server/ai/services/groqClient.ts` + mensagens de erro amigáveis em
  `server/ai/constants.ts` (cota, rate limit).
- **Tenancy/acesso**: `requireDocumentRequestContext` + gate de visualização (mesmo padrão do
  endpoint `api/documents/rag-query.ts` existente).

## Backend

### `server/services/chat/documentChatService.ts` (novo)

Entrada: `{ ctx: DocumentRequestContext, documentId, messages: ChatMessage[], question }`.
`messages` é o histórico da conversa mantido pelo cliente (efêmero).

1. Verifica acesso de visualização ao documento; `ServiceError` 403/404 caso contrário.
2. Carrega chunks da versão atual. Sem chunks → `ServiceError('...', 'DOCUMENT_CHAT_NO_TEXT', 422)`.
3. Orçamento de contexto: se `Σ chars(chunks) + histórico + margem de resposta` couber na janela
   do modelo configurado, envia o documento inteiro em ordem de `chunkIndex`; senão, scoring
   léxico da pergunta → top-K chunks (K calculado pelo orçamento).
4. System prompt (pt-BR): responder somente com base no documento fornecido; citar número de
   página ao afirmar algo; dizer explicitamente quando a informação não está no documento.
5. Chamada ao Groq (mesmo modelo de `GROQ_MODEL`) com histórico + pergunta.
6. Resposta: `{ answer, sources: [{ pageNumber?, snippet }], model, truncatedContext: boolean }`.

### `api/documents/[documentId]/chat.ts` (novo)

- `POST` apenas; demais métodos → 405.
- `requireDocumentRequestContext` no topo; corpo validado com Zod (`messages`, `question`).
- try/catch padrão: `ServiceError` → status/código; erro desconhecido → rethrow.
- **Registrar a rota no `server/apiServer.ts`** (tabela de rotas manual — obrigatório fora do Vercel).
- Erros da Groq (cota/rate) mapeados para as mensagens amigáveis existentes.

## Frontend

### Módulo novo `src/features/document-chat/`

- `api/documentChatApi.ts` — wrapper `POST /api/documents/:id/chat` sobre `src/lib/api.ts`.
- `hooks/useDocumentChat.ts` — estado local das mensagens + mutation (React Query) com
  tratamento de erro via toast (`sonner`), padrão do app.
- `components/DocumentChatPanel.tsx` — UI do chat: lista de mensagens, input, fontes citadas
  (página + snippet), estados de loading/erro/vazio. Reutilizado nas duas superfícies.
- `components/DocumentChatDrawer.tsx` — drawer lateral sobre a biblioteca.
- `DocumentChatPage.tsx` — seção dedicada: seletor de documento (reutiliza a API de listagem
  existente) + `DocumentChatPanel`.

### Integração

- Rota `/chat` em `src/app/routes.tsx` + lazy route em `src/app/lazyRoutes.tsx`.
- Item na sidebar: "Chat com documentos" (visível a qualquer usuário autenticado; o gate real
  é por documento, no backend).
- Menu de contexto: item "Conversar com IA" na seção de arquivo do
  `ExplorerContextMenu.tsx`, acionável de `DocumentFileRow` e `DocumentFileCard` → abre o drawer
  com o documento carregado.

## Tratamento de erros

| Caso | Comportamento |
|---|---|
| Doc sem chunks (não analisado/sem OCR) | 422 `DOCUMENT_CHAT_NO_TEXT`; UI mostra aviso amigável com sugestão de reanalisar |
| Sem permissão de visualização | 403/404 padrão `ServiceError` |
| Cota/rate limit Groq | Mensagens amigáveis existentes de `server/ai/constants.ts`; UI exibe no painel |
| Falha de rede/500 | Toast padrão + botão de tentar de novo na última mensagem |

## Testes

`tests/document-chat.test.ts` (node test runner, padrão do repo), com cliente Groq mockado:

- Acesso negado → 403/404.
- Documento sem chunks → `DOCUMENT_CHAT_NO_TEXT`.
- Seleção de contexto: doc pequeno → todos os chunks em ordem; doc grande → top-K léxico
  e `truncatedContext: true`.
- Montagem do prompt (system + histórico + pergunta).
- Handler: 405 para métodos não-POST, validação Zod do corpo.

## Fora do escopo (v1)

- Conversas multi-documento / biblioteca inteira.
- Persistência de conversas.
- Streaming de resposta.
- Embeddings / banco vetorial (porta plugável reservada via `RetrievalMode`).
