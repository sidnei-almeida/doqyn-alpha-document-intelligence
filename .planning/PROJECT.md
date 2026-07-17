# DOQYN Alpha — Document Intelligence

## What This Is

A multi-tenant SaaS platform for document management with AI-assisted classification, metadata extraction, e-signature, sharing, and governance workflows. React 19 SPA + Vercel-style Node API, MongoDB, Redis/BullMQ, Cloudflare R2. Auth via sibling `doqyn-auth-service`.

## Core Value

Tenants can securely upload, analyze, and manage documents — and understand what matters in a document without reading the full file.

## Requirements

### Validated

- ✓ Document upload → AI classification/metadata → tenant-scoped Mongo persistence
- ✓ Canonical metadata key normalization (`shared/metadataKeyNormalize.ts`)
- ✓ `documents.searchMeta` projection (people, dates, title, validityDate including prazo-inferred) via `projectDocumentSearchMeta`
- ✓ Document viewer with Details aside (`DocumentViewerDetailsPanel`)

### Active

**Milestone focus: Internacionalização e multi-país (BR / PY / US) — expandir o app para Paraguai e Estados Unidos.**

- [ ] Fundação de i18n (react-i18next) + detecção automática de idioma do navegador + `<html lang>` dinâmico
- [ ] Seletor de idioma com persistência (localStorage), sobrepondo a auto-detecção
- [ ] Formatação de data/número sensível ao locale ativo (substituir `pt-BR` hardcoded)
- [ ] Identificadores fiscais por país (BR CPF/CNPJ, PY CI/RUC, US SSN/EIN) no cadastro/revisão
- [ ] Telefone por país (BR +55, PY +595, US +1) em E.164 + normalização no servidor

### Out of Scope (this milestone)

- Tradução 100% do app (incremental; cobre shell, auth/cadastro, biblioteca, viewer)
- Persistir idioma no perfil do `doqyn-auth-service` (deferido; v1 usa localStorage)
- Milestone "Viewer — Detalhes com metadados standard" (deferida)
- Billing/moeda multi-país e novos países além de BR/PY/US

## Context

- Previous Claude Code GSD cycle (Audit Hardening P1) was discarded 2026-07-15 — not product direction.
- Codebase map: `.planning/codebase/*`
- Standard field vocabulary: `CANONICAL_METADATA_LABELS` + `projectSearchMeta` person/date roles

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Enrich Details panel first (not full Ficha mode) | Lower UX risk; reuses existing aside | Pending |
| Curated standard fields only | Avoid dumping 12+ arbitrary keys | Pending |

## Evolution

Update at phase / milestone boundaries via GSD workflows.

---
*Last updated: 2026-07-15 — reset after discarding Claude Code audit milestone*
