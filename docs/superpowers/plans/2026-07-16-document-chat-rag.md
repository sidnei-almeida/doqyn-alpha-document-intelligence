# Chat com Documentos (RAG via Groq) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conversar com um documento (1 doc por conversa, efêmero) via Groq, com entrada pelo menu de contexto da biblioteca (drawer) e por uma seção dedicada `/chat`.

**Architecture:** Token-first RAG sem vetorial: os chunks já persistidos no Mongo são enviados inteiros ao modelo quando cabem na janela (llama-4-scout, 131k tokens); quando não cabem, o retriever léxico existente seleciona top-K pela pergunta. Serviço novo `documentChatService` orquestra acesso → contexto → Groq; handler Vercel-style novo; frontend em feature module `document-chat` com painel reutilizado em drawer e página.

**Tech Stack:** Node 22 + TypeScript strict, Zod, groq-sdk (client existente), MongoDB (chunks existentes), React 19 + React Query + WorkspaceSideDrawer existente.

**Spec:** `docs/superpowers/specs/2026-07-16-document-chat-rag-design.md`

## Global Constraints

- Imports server-side sempre com extensão `.js` (verbatimModuleSyntax + NodeNext).
- `import type { ... }` explícito para tipos.
- Mensagens de erro ao cliente em pt-BR + `code` machine-readable (`ServiceError`).
- Toda query Mongo com `tenantScopeFilterFromContext(ctx.storage)` — nunca sem escopo de tenant.
- Rota nova DEVE ser registrada em `server/apiServer.ts` (tabela manual).
- Testes: node test runner via `npx tsx --test tests/<arquivo>.test.ts`, arquivos `kebab-case.test.ts` em `tests/` (flat).
- Prettier: single quotes, semi, printWidth 100; classes Tailwind auto-ordenadas.
- Conversa efêmera: nada de coleções novas no Mongo; histórico vem do cliente a cada request.
- NÃO usar `db.collection('...')` direto — sempre `ctx.collections` / helpers existentes.

---

### Task 1: Retrieval léxico por pergunta livre

**Files:**
- Modify: `server/services/hybridChunkRetriever.ts` (adicionar export no fim do arquivo)
- Test: `tests/document-chat-retrieval.test.ts`

**Interfaces:**
- Consumes: internos do módulo — `uniqueTerms`, `scoreTermsInChunk`, `toRetrievedChunk`, `sortAndLimit`, `fallbackChunks` (já existem em `hybridChunkRetriever.ts`); tipos `DocumentChunk`/`RetrievedChunk` de `server/ai/types/documentAi.types.ts`.
- Produces: `retrieveChunksForQuestion(input: { chunks: DocumentChunk[]; question: string; topK?: number }): RetrievedChunk[]` — usado pela Task 3.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/document-chat-retrieval.test.ts
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { retrieveChunksForQuestion } from '../server/services/hybridChunkRetriever.js';
import type { DocumentChunk } from '../server/ai/types/documentAi.types.js';

function chunk(id: string, chunkIndex: number, text: string, pageNumber?: number): DocumentChunk {
  return { id, chunkIndex, text, pageNumber };
}

test('retorna chunks que casam com termos da pergunta, ordenados por score', () => {
  const chunks = [
    chunk('c1', 0, 'Cláusula primeira: o objeto deste contrato é a prestação de serviços.', 1),
    chunk('c2', 1, 'A multa por rescisão antecipada será de R$ 5.000,00.', 2),
    chunk('c3', 2, 'Foro da comarca de São Paulo para dirimir controvérsias.', 3),
  ];
  const result = retrieveChunksForQuestion({
    chunks,
    question: 'Qual o valor da multa por rescisão?',
    topK: 2,
  });
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'c2');
  assert.ok(result[0].score > 0);
});

test('pergunta sem termos casando cai no fallback (primeiros chunks)', () => {
  const chunks = [
    chunk('c1', 0, 'texto alfa', 1),
    chunk('c2', 1, 'texto beta', 2),
  ];
  const result = retrieveChunksForQuestion({ chunks, question: 'zzzz wwww', topK: 1 });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'c1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/document-chat-retrieval.test.ts`
Expected: FAIL — `retrieveChunksForQuestion` não é exportado.

- [ ] **Step 3: Write minimal implementation**

Adicionar ao FIM de `server/services/hybridChunkRetriever.ts` (depois de `buildRetrievalStats`):

```typescript
/** Seleciona chunks relevantes para uma pergunta livre do chat documental. */
export function retrieveChunksForQuestion(input: {
  chunks: DocumentChunk[];
  question: string;
  topK?: number;
}): RetrievedChunk[] {
  const limit = input.topK ?? 12;
  const terms = uniqueTerms(
    input.question
      .split(/[\s?!.,;:()"']+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3),
  );

  const scored = input.chunks.map((chunk) => {
    const { score, matchedTerms } = scoreTermsInChunk(chunk, terms, { proximity: true });
    return toRetrievedChunk(chunk, score, matchedTerms, 'extraction');
  });

  const positive = scored.filter((chunk) => chunk.score > 0);
  const top = sortAndLimit(positive, limit);

  return top.length > 0 ? top : fallbackChunks(input.chunks, limit, 'extraction');
}
```

Nota: se `fallbackChunks` tiver assinatura diferente (conferir linha ~236), replicar exatamente a chamada usada em `retrieveChunksForField` (linha ~305).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/document-chat-retrieval.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Commit**

```bash
git add tests/document-chat-retrieval.test.ts server/services/hybridChunkRetriever.ts
git commit -m "feat(chat): retrieval léxico por pergunta livre"
```

---

### Task 2: Completions de chat no cliente Groq

**Files:**
- Modify: `server/ai/services/groqClient.ts` (adicionar tipos e função exportada no fim)
- Test: `tests/document-chat-groq-client.test.ts`

**Interfaces:**
- Consumes: internos do módulo — `getGroqClient()`, `withGroqRequestTimeout`, `getGroqRequestTimeoutMs()`, `getGroqMaxOutputTokens()`, `getGroqModel()` (já existem no arquivo).
- Produces:
  - `type GroqChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }`
  - `completeChatConversation(messages: GroqChatMessage[], options?: { model?: string; context?: GroqPromptContext }): Promise<string>` — usado pela Task 3.

- [ ] **Step 1: Write the failing test** (estrutural, padrão do repo — cf. `tests/groq-analysis-pipeline.test.ts`)

```typescript
// tests/document-chat-groq-client.test.ts
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('server/ai/services/groqClient.ts', 'utf-8');

test('groqClient expõe completeChatConversation para o chat documental', () => {
  assert.ok(source.includes('export async function completeChatConversation'));
  assert.ok(source.includes("role: 'system' | 'user' | 'assistant'"));
});

test('chat NÃO força response_format json (resposta é texto livre)', () => {
  const fnStart = source.indexOf('export async function completeChatConversation');
  assert.ok(fnStart > -1);
  const fnBody = source.slice(fnStart);
  assert.ok(!fnBody.includes('response_format'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/document-chat-groq-client.test.ts`
Expected: FAIL — export ausente.

- [ ] **Step 3: Write minimal implementation**

Adicionar ao FIM de `server/ai/services/groqClient.ts`:

```typescript
export type GroqChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Completion de conversa (texto livre) para o chat documental. */
export async function completeChatConversation(
  messages: GroqChatMessage[],
  options?: { model?: string; context?: GroqPromptContext },
): Promise<string> {
  const model = options?.model ?? getGroqModel();
  const context = options?.context;
  const startedAt = Date.now();

  logger.info('groq chat completion started', {
    requestId: context?.requestId,
    operation: context?.operation ?? 'document_chat',
    model,
    messageCount: messages.length,
  });

  const client = getGroqClient();
  const completion = await withGroqRequestTimeout(
    client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: getGroqMaxOutputTokens(),
      messages,
    }),
    getGroqRequestTimeoutMs(),
  );

  const content = completion.choices[0]?.message?.content ?? '';

  logger.info('groq chat completion completed', {
    requestId: context?.requestId,
    model,
    durationMs: Date.now() - startedAt,
    outputChars: content.length,
  });

  return content;
}
```

Nota: erros da API Groq propagam como já acontece em `callGroqCompletion` — o handler (Task 4) traduz. Se `withGroqRequestTimeout` exigir tipagem explícita do retorno, seguir o uso existente em `callGroqCompletion` (linha ~176).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/document-chat-groq-client.test.ts && npx tsc -p tsconfig.server.json --noEmit`
Expected: PASS (2/2) e typecheck OK.

- [ ] **Step 5: Commit**

```bash
git add tests/document-chat-groq-client.test.ts server/ai/services/groqClient.ts
git commit -m "feat(chat): completions de conversa texto-livre no cliente Groq"
```

---

### Task 3: Serviço de chat documental

**Files:**
- Create: `server/services/chat/documentChatService.ts`
- Test: `tests/document-chat-service.test.ts`

**Interfaces:**
- Consumes: `retrieveChunksForQuestion` (Task 1), `completeChatConversation`/`GroqChatMessage` (Task 2), `queryDocumentChunksForRag` + `mongoChunksToDocumentChunks` de `server/services/documentChunkService.js`, `ServiceError` de `server/utils/serviceErrors.js`, `tenantScopeFilterFromContext`/`assertCanAccessDocument` de `server/tenancy/tenantQuery.js`, tipo do ctx igual ao de `documentRagQueryService.ts` (`RagChunkQueryInput['ctx']`).
- Produces (usado pela Task 4):
  - `type DocumentChatMessage = { role: 'user' | 'assistant'; content: string }`
  - `type DocumentChatResult = { answer: string; sources: Array<{ pageNumber?: number; snippet: string }>; model: string; truncatedContext: boolean }`
  - `chatWithDocument(input: { ctx: RagChunkQueryInput['ctx']; documentId: string; question: string; messages: DocumentChatMessage[]; requestId?: string }): Promise<DocumentChatResult>`
  - Puras (testáveis): `selectChatContext(chunks: DocumentChunk[], question: string, budgetChars: number): { contextText: string; truncated: boolean; sources: Array<{ pageNumber?: number; snippet: string }> }` e `buildChatMessages(input: { documentTitle: string; contextText: string; history: DocumentChatMessage[]; question: string }): GroqChatMessage[]`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/document-chat-service.test.ts
import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  selectChatContext,
  buildChatMessages,
  CHAT_CONTEXT_BUDGET_CHARS,
} from '../server/services/chat/documentChatService.js';
import type { DocumentChunk } from '../server/ai/types/documentAi.types.js';

function chunk(id: string, chunkIndex: number, text: string, pageNumber?: number): DocumentChunk {
  return { id, chunkIndex, text, pageNumber };
}

test('doc pequeno: contexto contém todos os chunks em ordem, sem truncar', () => {
  const chunks = [chunk('c2', 1, 'segundo trecho', 2), chunk('c1', 0, 'primeiro trecho', 1)];
  const result = selectChatContext(chunks, 'qualquer pergunta', 10_000);
  assert.equal(result.truncated, false);
  assert.ok(result.contextText.indexOf('primeiro trecho') < result.contextText.indexOf('segundo trecho'));
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources[0].pageNumber, 1);
});

test('doc grande: contexto trunca via retrieval léxico e marca truncated', () => {
  const big = Array.from({ length: 50 }, (_, i) =>
    chunk(`c${i}`, i, `trecho genérico número ${i} ${'x'.repeat(400)}`, i + 1),
  );
  big.push(chunk('alvo', 50, 'A multa por rescisão antecipada será de R$ 5.000,00.', 51));
  const result = selectChatContext(big, 'qual a multa por rescisão?', 3_000);
  assert.equal(result.truncated, true);
  assert.ok(result.contextText.includes('multa por rescisão'));
  assert.ok(result.contextText.length <= 3_000 + 200);
});

test('budget default é positivo e generoso (janela 131k)', () => {
  assert.ok(CHAT_CONTEXT_BUDGET_CHARS >= 200_000);
});

test('buildChatMessages monta system pt-BR + histórico + pergunta', () => {
  const messages = buildChatMessages({
    documentTitle: 'Contrato X',
    contextText: '[Página 1] cláusula',
    history: [
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: 'olá' },
    ],
    question: 'qual o objeto?',
  });
  assert.equal(messages[0].role, 'system');
  assert.ok(messages[0].content.includes('Contrato X'));
  assert.ok(messages[0].content.includes('não está no documento'));
  assert.equal(messages[1].role, 'user');
  assert.equal(messages[2].role, 'assistant');
  assert.equal(messages[3].role, 'user');
  assert.equal(messages[3].content, 'qual o objeto?');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/document-chat-service.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```typescript
// server/services/chat/documentChatService.ts
import { ServiceError } from '../../utils/serviceErrors.js';
import {
  mongoChunksToDocumentChunks,
  queryDocumentChunksForRag,
  type RagChunkQueryInput,
} from '../documentChunkService.js';
import { retrieveChunksForQuestion } from '../hybridChunkRetriever.js';
import {
  completeChatConversation,
  getGroqModel,
  type GroqChatMessage,
} from '../../ai/services/groqClient.js';
import type { DocumentChunk } from '../../ai/types/documentAi.types.js';
import { tenantScopeFilterFromContext, assertCanAccessDocument } from '../../tenancy/tenantQuery.js';

export type DocumentChatMessage = { role: 'user' | 'assistant'; content: string };

export type DocumentChatResult = {
  answer: string;
  sources: Array<{ pageNumber?: number; snippet: string }>;
  model: string;
  truncatedContext: boolean;
};

/**
 * Orçamento de contexto em chars (~4 chars/token). Janela do llama-4-scout é
 * 131k tokens ≈ 460k chars; reservamos folga para histórico + resposta.
 */
export const CHAT_CONTEXT_BUDGET_CHARS = 320_000;

const MAX_HISTORY_MESSAGES = 20;

function snippetOf(text: string, max = 200): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function formatChunk(chunk: DocumentChunk): string {
  const page = chunk.pageNumber ? `[Página ${chunk.pageNumber}] ` : '';
  return `${page}${chunk.text.trim()}`;
}

export function selectChatContext(
  chunks: DocumentChunk[],
  question: string,
  budgetChars: number,
): {
  contextText: string;
  truncated: boolean;
  sources: Array<{ pageNumber?: number; snippet: string }>;
} {
  const ordered = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const totalChars = ordered.reduce((sum, chunk) => sum + chunk.text.length, 0);

  if (totalChars <= budgetChars) {
    return {
      contextText: ordered.map(formatChunk).join('\n\n'),
      truncated: false,
      sources: ordered.map((chunk) => ({
        pageNumber: chunk.pageNumber,
        snippet: snippetOf(chunk.text),
      })),
    };
  }

  const retrieved = retrieveChunksForQuestion({ chunks: ordered, question, topK: 24 });
  const selected: DocumentChunk[] = [];
  let used = 0;
  for (const chunk of retrieved) {
    if (used + chunk.text.length > budgetChars) break;
    selected.push(chunk);
    used += chunk.text.length;
  }
  const byIndex = selected.sort((a, b) => a.chunkIndex - b.chunkIndex);

  return {
    contextText: byIndex.map(formatChunk).join('\n\n'),
    truncated: true,
    sources: byIndex.map((chunk) => ({
      pageNumber: chunk.pageNumber,
      snippet: snippetOf(chunk.text),
    })),
  };
}

export function buildChatMessages(input: {
  documentTitle: string;
  contextText: string;
  history: DocumentChatMessage[];
  question: string;
}): GroqChatMessage[] {
  const system: GroqChatMessage = {
    role: 'system',
    content: [
      `Você é o assistente documental do DOQYN. O usuário está conversando sobre o documento "${input.documentTitle}".`,
      'Responda em português do Brasil, SOMENTE com base no conteúdo do documento abaixo.',
      'Ao afirmar algo, cite a página quando disponível (ex.: "na página 2...").',
      'Se a informação não está no documento, diga explicitamente que ela não está no documento — não invente.',
      '',
      '--- CONTEÚDO DO DOCUMENTO ---',
      input.contextText,
      '--- FIM DO DOCUMENTO ---',
    ].join('\n'),
  };

  const history = input.history.slice(-MAX_HISTORY_MESSAGES).map(
    (message): GroqChatMessage => ({ role: message.role, content: message.content }),
  );

  return [system, ...history, { role: 'user', content: input.question }];
}

export async function chatWithDocument(input: {
  ctx: RagChunkQueryInput['ctx'];
  documentId: string;
  question: string;
  messages: DocumentChatMessage[];
  requestId?: string;
}): Promise<DocumentChatResult> {
  const doc = await input.ctx.collections.documents.findOne({
    _id: input.documentId,
    ...tenantScopeFilterFromContext(input.ctx.storage),
    deletedAt: { $in: [null, undefined] },
    permanentlyDeletedAt: { $in: [null, undefined] },
    deactivatedAt: { $in: [null, undefined] },
  } as Record<string, unknown>);

  if (!doc) {
    throw new ServiceError('Documento não encontrado.', 'DOCUMENT_NOT_FOUND', 404);
  }
  assertCanAccessDocument(doc as Record<string, unknown>, input.ctx.storage);

  const result = await queryDocumentChunksForRag({
    ctx: input.ctx,
    documentId: input.documentId,
    currentOnly: true,
  });

  if (result.chunks.length === 0) {
    throw new ServiceError(
      'Este documento ainda não tem texto extraído para conversa. Reenvie ou reanalise o documento.',
      'DOCUMENT_CHAT_NO_TEXT',
      422,
    );
  }

  const chunks = mongoChunksToDocumentChunks(result.chunks);
  const historyChars = input.messages.reduce((sum, message) => sum + message.content.length, 0);
  const budget = Math.max(CHAT_CONTEXT_BUDGET_CHARS - historyChars, 40_000);
  const context = selectChatContext(chunks, input.question, budget);

  const title =
    typeof (doc as { title?: unknown }).title === 'string'
      ? ((doc as { title: string }).title)
      : 'Documento';

  const groqMessages = buildChatMessages({
    documentTitle: title,
    contextText: context.contextText,
    history: input.messages,
    question: input.question,
  });

  const answer = await completeChatConversation(groqMessages, {
    context: { requestId: input.requestId, operation: 'document_chat' },
  });

  return {
    answer,
    sources: context.sources.slice(0, 8),
    model: getGroqModel(),
    truncatedContext: context.truncated,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/document-chat-service.test.ts && npx tsc -p tsconfig.server.json --noEmit`
Expected: PASS (4/4) e typecheck OK.

- [ ] **Step 5: Commit**

```bash
git add tests/document-chat-service.test.ts server/services/chat/documentChatService.ts
git commit -m "feat(chat): serviço de chat documental com orçamento de contexto"
```

---

### Task 4: Endpoint POST /api/documents/[documentId]/chat

**Files:**
- Create: `api/documents/[documentId]/chat.ts`
- Modify: `server/apiServer.ts` (adicionar pattern na lista `patterns`, junto dos outros `documents/[documentId]/*`, ~linha 168)
- Test: `tests/document-chat-endpoint.test.ts`

**Interfaces:**
- Consumes: `chatWithDocument`/`DocumentChatMessage` (Task 3), `requireAuth`, `buildDocumentRequestContext`, `isServiceError`, Zod.
- Produces: rota HTTP `POST /api/documents/:documentId/chat` com body `{ question: string, messages: Array<{role, content}> }` → `DocumentChatResult` (JSON). Usada pela Task 5.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/document-chat-endpoint.test.ts
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('handler do chat existe e segue o contrato do repo', () => {
  const source = readFileSync('api/documents/[documentId]/chat.ts', 'utf-8');
  assert.ok(source.includes('export default async function handler'));
  assert.ok(source.includes("req.method !== 'POST'"));
  assert.ok(source.includes('requireAuth'));
  assert.ok(source.includes('chatWithDocument'));
  assert.ok(source.includes('isServiceError'));
  assert.ok(source.includes('safeParse'));
});

test('rota registrada no apiServer (dispatcher manual)', () => {
  const source = readFileSync('server/apiServer.ts', 'utf-8');
  assert.ok(source.includes('api/documents/[documentId]/chat.js'));
  assert.ok(/\\\/api\\\/documents\\\/\(\[\^\/\]\+\)\\\/chat/.test(source) || source.includes('/chat$'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/document-chat-endpoint.test.ts`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Write the handler**

```typescript
// api/documents/[documentId]/chat.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireAuth } from '../../../server/auth/requireAuth.js';
import { buildDocumentRequestContext } from '../../../server/tenancy/documentRequestContext.js';
import { isServiceError } from '../../../server/utils/serviceErrors.js';
import { chatWithDocument } from '../../../server/services/chat/documentChatService.js';
import { extractRequestContext } from '../../../server/utils/requestContext.js';

const chatBodySchema = z.object({
  question: z.string().trim().min(1).max(4000),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(16_000),
      }),
    )
    .max(40)
    .default([]),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const documentId = typeof req.query.documentId === 'string' ? req.query.documentId.trim() : '';
  if (!documentId) {
    return res.status(400).json({ message: 'documentId é obrigatório.', code: 'INVALID_PAYLOAD' });
  }

  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido para o chat documental.',
      code: 'INVALID_PAYLOAD',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  const reqCtx = extractRequestContext(req);

  try {
    const docCtx = await buildDocumentRequestContext(user);
    const result = await chatWithDocument({
      ctx: docCtx,
      documentId,
      question: parsed.data.question,
      messages: parsed.data.messages,
      requestId: reqCtx.requestId,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    const message =
      error instanceof Error && /quota|rate|429/i.test(error.message)
        ? 'Limite de uso da IA atingido. Tente novamente em instantes.'
        : 'Não foi possível responder agora. Tente novamente.';
    return res.status(502).json({ message, code: 'DOCUMENT_CHAT_FAILED' });
  }
}
```

Nota: se `extractRequestContext` exigir mais campos, seguir exatamente o uso em `api/documents/confirm-analysis.ts:20`.

- [ ] **Step 4: Register route in apiServer.ts**

Na lista `patterns` de `server/apiServer.ts`, junto aos outros `documents/[documentId]/*` (~linha 168), adicionar:

```typescript
    {
      regex: /^\/api\/documents\/([^/]+)\/chat$/,
      loader: () => import('../api/documents/[documentId]/chat.js'),
      paramKeys: ['documentId'],
    },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx tsx --test tests/document-chat-endpoint.test.ts && npx tsc -p tsconfig.server.json --noEmit`
Expected: PASS (2/2) e typecheck OK.

- [ ] **Step 6: Commit**

```bash
git add tests/document-chat-endpoint.test.ts "api/documents/[documentId]/chat.ts" server/apiServer.ts
git commit -m "feat(chat): endpoint POST /api/documents/:id/chat registrado no dispatcher"
```

---

### Task 5: Feature module frontend — api + hook

**Files:**
- Create: `src/features/document-chat/api/documentChatApi.ts`
- Create: `src/features/document-chat/types.ts`
- Create: `src/features/document-chat/hooks/useDocumentChat.ts`
- Test: `tests/document-chat-frontend.test.ts`

**Interfaces:**
- Consumes: `authFetch`, `getFetchCredentials`, `withAuthHeaders` de `@/auth/apiAuth` (mesmo padrão de `src/features/document-send/services/confirmAnalysis.ts`); endpoint da Task 4.
- Produces (usado pelas Tasks 6–8):
  - `types.ts`: `ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; sources?: ChatSource[]; error?: boolean }`, `ChatSource = { pageNumber?: number; snippet: string }`, `DocumentChatResponse = { answer: string; sources: ChatSource[]; model: string; truncatedContext: boolean }`
  - `sendDocumentChatMessage(documentId: string, body: { question: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> }): Promise<DocumentChatResponse>`
  - `useDocumentChat(documentId: string | null)` → `{ messages: ChatMessage[]; sendMessage: (question: string) => void; isPending: boolean; reset: () => void }`

- [ ] **Step 1: Write the failing test** (estrutural, padrão dos testes de layout do repo)

```typescript
// tests/document-chat-frontend.test.ts
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('api do chat usa authFetch e endpoint correto', () => {
  const source = readFileSync('src/features/document-chat/api/documentChatApi.ts', 'utf-8');
  assert.ok(source.includes('authFetch'));
  assert.ok(source.includes('/chat'));
  assert.ok(source.includes("method: 'POST'"));
});

test('hook mantém histórico local (efêmero) e usa useMutation', () => {
  const source = readFileSync('src/features/document-chat/hooks/useDocumentChat.ts', 'utf-8');
  assert.ok(source.includes('useMutation'));
  assert.ok(source.includes('useState'));
  assert.ok(source.includes('sonner') || source.includes('toast'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/document-chat-frontend.test.ts`
Expected: FAIL — arquivos não existem.

- [ ] **Step 3: Implement types + api + hook**

```typescript
// src/features/document-chat/types.ts
export type ChatSource = { pageNumber?: number; snippet: string };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  error?: boolean;
};

export type DocumentChatResponse = {
  answer: string;
  sources: ChatSource[];
  model: string;
  truncatedContext: boolean;
};
```

```typescript
// src/features/document-chat/api/documentChatApi.ts
import { authFetch, getFetchCredentials, withAuthHeaders } from '@/auth/apiAuth';
import type { DocumentChatResponse } from '../types';

export async function sendDocumentChatMessage(
  documentId: string,
  body: {
    question: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  },
): Promise<DocumentChatResponse> {
  const response = await authFetch(`/api/documents/${documentId}/chat`, {
    method: 'POST',
    credentials: getFetchCredentials(),
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as
    | DocumentChatResponse
    | { message?: string }
    | null;

  if (!response.ok || !data || !('answer' in data)) {
    const message =
      data && 'message' in data && data.message
        ? data.message
        : 'Não foi possível responder agora. Tente novamente.';
    throw new Error(message);
  }

  return data;
}
```

```typescript
// src/features/document-chat/hooks/useDocumentChat.ts
import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sendDocumentChatMessage } from '../api/documentChatApi';
import type { ChatMessage } from '../types';

let messageSeq = 0;
function nextId(): string {
  messageSeq += 1;
  return `chat_${Date.now()}_${messageSeq}`;
}

/** Conversa efêmera com um documento — histórico vive apenas neste hook. */
export function useDocumentChat(documentId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages([]);
  }, [documentId]);

  const mutation = useMutation({
    mutationFn: (question: string) => {
      if (!documentId) throw new Error('Selecione um documento para conversar.');
      const history = messages
        .filter((message) => !message.error)
        .map((message) => ({ role: message.role, content: message.content }));
      return sendDocumentChatMessage(documentId, { question, messages: history });
    },
    onMutate: (question: string) => {
      setMessages((current) => [...current, { id: nextId(), role: 'user', content: question }]);
    },
    onSuccess: (response) => {
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
        },
      ]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setMessages((current) => [
        ...current,
        { id: nextId(), role: 'assistant', content: error.message, error: true },
      ]);
    },
  });

  const sendMessage = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || mutation.isPending) return;
      mutation.mutate(trimmed);
    },
    [mutation],
  );

  const reset = useCallback(() => setMessages([]), []);

  return { messages, sendMessage, isPending: mutation.isPending, reset };
}
```

- [ ] **Step 4: Run tests + lint**

Run: `npx tsx --test tests/document-chat-frontend.test.ts && npx eslint src/features/document-chat/ && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS (2/2); lint limpo; typecheck sem erros NOVOS (há 1 erro pré-existente em `documentMetadataDisplay.ts`, ignorar).

- [ ] **Step 5: Commit**

```bash
git add tests/document-chat-frontend.test.ts src/features/document-chat/
git commit -m "feat(chat): api client e hook de conversa efêmera"
```

---

### Task 6: DocumentChatPanel (UI do chat)

**Files:**
- Create: `src/features/document-chat/components/DocumentChatPanel.tsx`
- Test: adicionar casos em `tests/document-chat-frontend.test.ts`

**Interfaces:**
- Consumes: `useDocumentChat` (Task 5), `Icon`/`ICON_SIZE`, `cn`, `Button` de `@/components/ui/Button`.
- Produces: `DocumentChatPanel({ documentId, documentTitle }: { documentId: string | null; documentTitle?: string })` — usado nas Tasks 7 e 8.

- [ ] **Step 1: Add failing structural tests**

Adicionar a `tests/document-chat-frontend.test.ts`:

```typescript
test('painel de chat: estados vazio/carregando, fontes e input', () => {
  const source = readFileSync(
    'src/features/document-chat/components/DocumentChatPanel.tsx',
    'utf-8',
  );
  assert.ok(source.includes('useDocumentChat'));
  assert.ok(source.includes('data-testid="document-chat-panel"'));
  assert.ok(source.includes('data-testid="document-chat-input"'));
  assert.ok(source.includes('isPending'));
  assert.ok(source.includes('sources'));
  assert.ok(source.includes('aria-'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test tests/document-chat-frontend.test.ts`
Expected: FAIL — arquivo não existe.

- [ ] **Step 3: Implement the panel**

```tsx
// src/features/document-chat/components/DocumentChatPanel.tsx
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { useDocumentChat } from '../hooks/useDocumentChat';
import type { ChatMessage } from '../types';

function SourceChips({ message }: { message: ChatMessage }) {
  if (!message.sources || message.sources.length === 0) return null;
  const pages = Array.from(
    new Set(message.sources.map((source) => source.pageNumber).filter(Boolean)),
  ) as number[];
  if (pages.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {pages.map((page) => (
        <span
          key={page}
          className="rounded-full border border-doqyn-border-subtle px-2 py-0.5 text-[10px] text-doqyn-muted"
        >
          Página {page}
        </span>
      ))}
    </div>
  );
}

export function DocumentChatPanel({
  documentId,
  documentTitle,
}: {
  documentId: string | null;
  documentTitle?: string;
}) {
  const { messages, sendMessage, isPending } = useDocumentChat(documentId);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isPending]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    sendMessage(draft);
    setDraft('');
  };

  return (
    <div
      data-testid="document-chat-panel"
      className="flex h-full min-h-0 flex-col"
      aria-label={documentTitle ? `Chat sobre ${documentTitle}` : 'Chat com documento'}
    >
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Icon name="forum" size={ICON_SIZE.lg} className="text-doqyn-subtle" />
            <p className="text-sm text-doqyn-muted">
              {documentId
                ? 'Pergunte qualquer coisa sobre este documento.'
                : 'Selecione um documento para começar a conversar.'}
            </p>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                message.role === 'user'
                  ? 'bg-doqyn-primary-bg text-doqyn-text'
                  : message.error
                    ? 'border border-doqyn-danger/40 bg-doqyn-surface text-doqyn-danger'
                    : 'bg-doqyn-surface text-doqyn-text',
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <SourceChips message={message} />
            </div>
          </div>
        ))}
        {isPending && (
          <div className="flex items-center gap-2 text-xs text-doqyn-muted" role="status">
            <Icon name="progress_activity" size={ICON_SIZE.sm} className="animate-spin" />
            Analisando o documento…
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-end gap-2 border-t border-doqyn-border-subtle p-3"
      >
        <textarea
          data-testid="document-chat-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              sendMessage(draft);
              setDraft('');
            }
          }}
          placeholder={documentId ? 'Pergunte sobre o documento…' : 'Selecione um documento primeiro'}
          disabled={!documentId || isPending}
          rows={2}
          className="min-h-[40px] flex-1 resize-none rounded-lg border border-doqyn-border-subtle bg-doqyn-bg px-3 py-2 text-sm text-doqyn-text placeholder:text-doqyn-subtle focus:outline-none"
          aria-label="Mensagem para o documento"
        />
        <button
          type="submit"
          disabled={!documentId || isPending || !draft.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-doqyn-primary text-white disabled:opacity-40"
          aria-label="Enviar pergunta"
        >
          <Icon name="send" size={ICON_SIZE.md} />
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run tests + lint**

Run: `npx tsx --test tests/document-chat-frontend.test.ts && npx eslint src/features/document-chat/`
Expected: PASS; lint limpo.

- [ ] **Step 5: Commit**

```bash
git add tests/document-chat-frontend.test.ts src/features/document-chat/components/DocumentChatPanel.tsx
git commit -m "feat(chat): painel de conversa com documento"
```

---

### Task 7: Drawer + menu de contexto na biblioteca

**Files:**
- Create: `src/features/document-chat/components/DocumentChatDrawer.tsx`
- Modify: `src/features/library/components/ExplorerContextMenu.tsx` (prop nova + MenuItem na seção `state.kind === 'file'`)
- Modify: `src/features/library/LibraryPage.tsx` (estado do drawer + wiring, perto de `onPreviewFile={handlePreview}` ~linha 777)
- Test: adicionar casos em `tests/document-chat-frontend.test.ts`

**Interfaces:**
- Consumes: `WorkspaceSideDrawer` (props: `onClose`, `title`, `subtitle?`, `testId`, `bodyClassName?`, `scrollable?`, `children`), `DocumentChatPanel` (Task 6), `DocumentListItem` de `@/types/document-library`.
- Produces: `DocumentChatDrawer({ document, onClose }: { document: DocumentListItem | null; onClose: () => void })`; prop `onChatWithFile?: (doc: DocumentListItem) => void` no `ExplorerContextMenu`.

- [ ] **Step 1: Add failing structural tests**

```typescript
test('drawer de chat usa WorkspaceSideDrawer e o painel', () => {
  const source = readFileSync(
    'src/features/document-chat/components/DocumentChatDrawer.tsx',
    'utf-8',
  );
  assert.ok(source.includes('WorkspaceSideDrawer'));
  assert.ok(source.includes('DocumentChatPanel'));
  assert.ok(source.includes('scrollable={false}'));
});

test('menu de contexto tem "Conversar com IA" na seção de arquivo', () => {
  const source = readFileSync('src/features/library/components/ExplorerContextMenu.tsx', 'utf-8');
  assert.ok(source.includes('onChatWithFile'));
  assert.ok(source.includes('Conversar com IA'));
});

test('LibraryPage abre o drawer de chat', () => {
  const source = readFileSync('src/features/library/LibraryPage.tsx', 'utf-8');
  assert.ok(source.includes('DocumentChatDrawer'));
  assert.ok(source.includes('onChatWithFile'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test tests/document-chat-frontend.test.ts`
Expected: FAIL nos 3 casos novos.

- [ ] **Step 3: Implement drawer**

```tsx
// src/features/document-chat/components/DocumentChatDrawer.tsx
import { WorkspaceSideDrawer } from '@/components/layout/WorkspaceSideDrawer';
import type { DocumentListItem } from '@/types/document-library';
import { DocumentChatPanel } from './DocumentChatPanel';

export function DocumentChatDrawer({
  document,
  onClose,
}: {
  document: DocumentListItem | null;
  onClose: () => void;
}) {
  if (!document) return null;
  return (
    <WorkspaceSideDrawer
      onClose={onClose}
      title="Conversar com IA"
      subtitle={document.title}
      testId="document-chat-drawer"
      scrollable={false}
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
    >
      <DocumentChatPanel documentId={document.id} documentTitle={document.title} />
    </WorkspaceSideDrawer>
  );
}
```

Nota: conferir o campo id do `DocumentListItem` (`id` vs `documentId`) em `src/types/document-library.ts` e usar o existente.

- [ ] **Step 4: Wire context menu**

Em `ExplorerContextMenu.tsx`:
1. Adicionar à type `ExplorerContextMenuProps`: `onChatWithFile?: (doc: DocumentListItem) => void;`
2. Adicionar prop no destructuring do componente.
3. Na seção `state.kind === 'file'`, logo após o MenuItem "Visualizar":

```tsx
                <MenuItem
                  compact
                  label="Conversar com IA"
                  icon="forum"
                  disabled={!onChatWithFile}
                  onClick={() => run(() => onChatWithFile?.(doc))}
                />
```

Em `LibraryPage.tsx`:
1. Import: `import { DocumentChatDrawer } from '@/features/document-chat/components/DocumentChatDrawer';` e `import type { DocumentListItem } from '@/types/document-library';` (se ainda não importado).
2. Estado: `const [chatDocument, setChatDocument] = useState<DocumentListItem | null>(null);`
3. No `<ExplorerContextMenu ...>` (~linha 777), adicionar: `onChatWithFile={setChatDocument}`
4. Renderizar junto dos outros drawers/modals da página: `<DocumentChatDrawer document={chatDocument} onClose={() => setChatDocument(null)} />`

- [ ] **Step 5: Run tests + lint**

Run: `npx tsx --test tests/document-chat-frontend.test.ts && npx eslint src/features/document-chat/ src/features/library/components/ExplorerContextMenu.tsx src/features/library/LibraryPage.tsx`
Expected: PASS; lint limpo.

- [ ] **Step 6: Commit**

```bash
git add tests/document-chat-frontend.test.ts src/features/document-chat/components/DocumentChatDrawer.tsx src/features/library/components/ExplorerContextMenu.tsx src/features/library/LibraryPage.tsx
git commit -m "feat(chat): entrada pelo menu de contexto com drawer na biblioteca"
```

---

### Task 8: Seção dedicada /chat (página + rota + sidebar)

**Files:**
- Create: `src/features/document-chat/DocumentChatPage.tsx`
- Modify: `src/app/lazyRoutes.tsx` (lazyNamed + export)
- Modify: `src/app/routes.tsx` (rota `/chat` nos children do AppLayout)
- Modify: `src/lib/constants.ts` (item em `NAV_ITEMS_LIBRARY_VIEWS`)
- Test: adicionar casos em `tests/document-chat-frontend.test.ts`

**Interfaces:**
- Consumes: `DocumentChatPanel` (Task 6), `api.documents.list` de `@/lib/api`, `PageShell` de `@/components/layout/PageShell`, `useSearchParams` de react-router-dom, `useQuery` de React Query.
- Produces: rota `/chat` (aceita `?doc=<documentId>` para pré-selecionar), export `DocumentChatRoute` em lazyRoutes.

- [ ] **Step 1: Add failing structural tests**

```typescript
test('página /chat existe com seletor de documento', () => {
  const source = readFileSync('src/features/document-chat/DocumentChatPage.tsx', 'utf-8');
  assert.ok(source.includes('DocumentChatPanel'));
  assert.ok(source.includes('PageShell'));
  assert.ok(source.includes('useSearchParams'));
  assert.ok(source.includes('api.documents.list'));
});

test('rota /chat registrada e no menu lateral', () => {
  const routes = readFileSync('src/app/routes.tsx', 'utf-8');
  assert.ok(routes.includes("path: '/chat'"));
  const lazy = readFileSync('src/app/lazyRoutes.tsx', 'utf-8');
  assert.ok(lazy.includes('DocumentChatRoute'));
  const constants = readFileSync('src/lib/constants.ts', 'utf-8');
  assert.ok(constants.includes("path: '/chat'"));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test tests/document-chat-frontend.test.ts`
Expected: FAIL nos 2 casos novos.

- [ ] **Step 3: Implement page**

```tsx
// src/features/document-chat/DocumentChatPage.tsx
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageShell } from '@/components/layout/PageShell';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DocumentChatPanel } from './components/DocumentChatPanel';

export function DocumentChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('doc');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['document-chat', 'documents'],
    queryFn: () => api.documents.list(),
  });

  const documents = useMemo(() => {
    const items = data?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((doc) => doc.title.toLowerCase().includes(term));
  }, [data, search]);

  const selected = documents.find((doc) => doc.id === selectedId) ?? null;

  return (
    <PageShell title="Chat com documentos">
      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="flex w-72 shrink-0 flex-col rounded-xl border border-doqyn-border-subtle bg-doqyn-card">
          <div className="p-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar documento…"
              aria-label="Buscar documento"
              className="w-full rounded-lg border border-doqyn-border-subtle bg-doqyn-bg px-3 py-2 text-sm text-doqyn-text placeholder:text-doqyn-subtle focus:outline-none"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
            {isLoading && <p className="px-2 py-4 text-xs text-doqyn-muted">Carregando…</p>}
            {!isLoading && documents.length === 0 && (
              <p className="px-2 py-4 text-xs text-doqyn-muted">Nenhum documento encontrado.</p>
            )}
            {documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSearchParams({ doc: doc.id })}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm',
                  doc.id === selectedId
                    ? 'bg-doqyn-selected text-doqyn-text'
                    : 'text-doqyn-muted hover:bg-doqyn-surface-hover',
                )}
              >
                <Icon name="description" size={ICON_SIZE.sm} className="shrink-0" />
                <span className="min-w-0 truncate">{doc.title}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-doqyn-border-subtle bg-doqyn-card">
          <DocumentChatPanel documentId={selected?.id ?? null} documentTitle={selected?.title} />
        </section>
      </div>
    </PageShell>
  );
}
```

Notas: (a) conferir a assinatura do `PageShell` (`title` prop vs children header) em outra página, ex. `src/features/audit/AuditPage.tsx`, e seguir o uso real; (b) conferir o shape de `DocumentListResponse.items` (`id`/`title`) em `src/types/document-library.ts` e ajustar.

- [ ] **Step 4: Register route + nav**

`src/app/lazyRoutes.tsx`:

```typescript
const LazyDocumentChatPage = lazyNamed(
  () => import('@/features/document-chat/DocumentChatPage'),
  'DocumentChatPage',
);
export const DocumentChatRoute = withRouteSuspense(LazyDocumentChatPage);
```

`src/app/routes.tsx` — import `DocumentChatRoute` e, nos children do AppLayout (junto de `/dashboard`):

```typescript
          { path: '/chat', element: <DocumentChatRoute /> },
```

`src/lib/constants.ts` — em `NAV_ITEMS_LIBRARY_VIEWS`, após "Favoritos":

```typescript
  { label: 'Chat com documentos', path: '/chat', icon: 'forum' },
```

- [ ] **Step 5: Run tests + lint + typecheck**

Run: `npx tsx --test tests/document-chat-frontend.test.ts && npx eslint src/features/document-chat/ src/app/ src/lib/constants.ts && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS; lint limpo; sem erros novos de typecheck.

- [ ] **Step 6: Commit**

```bash
git add tests/document-chat-frontend.test.ts src/features/document-chat/DocumentChatPage.tsx src/app/lazyRoutes.tsx src/app/routes.tsx src/lib/constants.ts
git commit -m "feat(chat): seção dedicada /chat com seletor de documento"
```

---

### Task 9: Verificação final end-to-end

**Files:**
- Nenhum novo — verificação.

- [ ] **Step 1: Run full targeted suite**

Run: `npx tsx --test tests/document-chat-*.test.ts && npx tsx --test tests/design-system.test.ts tests/dashboard-layout.test.ts`
Expected: todas PASS.

- [ ] **Step 2: Typecheck completo**

Run: `npx tsc -p tsconfig.server.json --noEmit && npx tsc -p tsconfig.app.json --noEmit`
Expected: server OK; app apenas com o erro pré-existente de `documentMetadataDisplay.ts`.

- [ ] **Step 3: Verificação manual (usuário)**

1. Reiniciar `npm run dev` (dispatcher de rotas não tem hot-reload).
2. Biblioteca → botão direito num documento analisado → "Conversar com IA" → drawer abre; perguntar algo cujo conteúdo está no doc; resposta deve citar página.
3. Documento sem análise (se houver) → deve mostrar mensagem "ainda não tem texto extraído".
4. Sidebar → "Chat com documentos" → selecionar doc na lista → conversar; trocar de doc → histórico zera (efêmero).
5. Tema dark E light.

- [ ] **Step 4: Final commit (se houver ajustes)**

```bash
git add -A src/features/document-chat tests/
git commit -m "chore(chat): ajustes finais da verificação end-to-end"
```

---

## Self-Review (executada na escrita)

- **Spec coverage:** serviço (Task 3), endpoint + dispatcher (Task 4), api/hook (Task 5), painel (Task 6), drawer + menu de contexto (Task 7), seção dedicada + rota + sidebar (Task 8), erros (`DOCUMENT_CHAT_NO_TEXT` na Task 3; mensagens amigáveis no handler Task 4), testes (todas as tasks) — sem lacunas.
- **Placeholders:** nenhum TBD/TODO; todos os steps têm código completo; notas de "conferir assinatura" apontam arquivo+linha concretos e existem porque o executor deve seguir o código real, não inventar.
- **Type consistency:** `DocumentChatMessage`/`DocumentChatResult` (Task 3) = contrato do handler (Task 4) = `DocumentChatResponse` (Task 5); `GroqChatMessage` (Task 2) consumido na Task 3; `retrieveChunksForQuestion` (Task 1) consumido na Task 3.
