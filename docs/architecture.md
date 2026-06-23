# Arquitetura — DOQYN Alpha

## Visão geral

O DOQYN Alpha segue uma arquitetura monorepo com frontend SPA e API serverless, preparada para deploy na Vercel.

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  Login → Upload → Documentos → Versionamento → Auditoria  │
└────────────────────────┬────────────────────────────────┘
                         │ /api/*
┌────────────────────────▼────────────────────────────────┐
│              API Handlers (Vercel / dev-server)          │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    server/services/                      │
│  documentService · processingService · auditService      │
│  metadataService · documentClassificationService         │
└──────────┬─────────────────────────────┬──────────────┘
           │                             │
┌──────────▼──────────┐       ┌──────────▼──────────────┐
│   MongoDB Atlas     │       │  Integrações futuras      │
│   (metadados)       │       │  Google Doc AI · S3 · R2  │
└─────────────────────┘       └───────────────────────────┘
```

## Princípios

1. **Metadados no MongoDB, arquivos fora** — O banco armazena referências, status, versões, hash e histórico. Arquivos reais irão para S3/R2.
2. **Interface em linguagem de negócio** — Nenhum termo técnico de infraestrutura é exposto ao usuário final.
3. **Autenticação isolada** — Camada `AuthProvider` permite alternar entre mock e Keycloak sem espalhar lógica.
4. **Serviços com nomes genéricos** — Pontos de integração para IA claramente definidos mas simulados nesta fase.

## Modelos de dados

| Modelo | Responsabilidade |
|--------|-----------------|
| `Document` | Documento principal com status, versão e metadados |
| `DocumentVersion` | Versões preservadas com hash e referência de storage |
| `AuditEvent` | Rastreabilidade de todas as ações |
| `ProcessingJob` | Pipeline de processamento com etapas |
| `Rule` | Regras de classificação e acesso (futuro) |

## Autenticação

```
VITE_AUTH_MODE=temporary → API com cookie JWT (desenvolvimento)
VITE_AUTH_MODE=mock     → MockAuthProvider (demonstração)
VITE_AUTH_MODE=keycloak → KeycloakAuthProvider (produção / SSO)
```

A troca é feita em `src/features/auth/getAuthProvider.ts` e `AuthProvider.tsx`.

## Processamento de documentos

Fluxo atual (simulado):

1. Upload recebido → `documentService.uploadDocument()`
2. Metadados extraídos → `metadataExtractionService`
3. Classificação → `documentClassificationService`
4. Job criado → `processingService.createProcessingJob()`
5. Evento de auditoria registrado

Pontos de integração futura estão marcados nos serviços com comentários `Future:`.

## Deploy

- **Frontend**: build Vite → assets estáticos
- **API**: funções serverless em `/api`
- **Banco**: MongoDB Atlas com connection pooling via cache global (serverless-friendly)

## Desenvolvimento local

O Vite faz proxy de `/api` para `localhost:3001`. O `server/dev-server.ts` emula o ambiente Vercel para testes locais.
