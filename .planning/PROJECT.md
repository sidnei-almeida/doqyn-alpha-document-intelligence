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

**Milestone focus: enrich the viewer Details panel with the standard metadata set (not a raw blob dump).**

- [ ] Show curated standard fields in Detalhes (parties, signature/doc dates, validity — explicit or inferred)
- [ ] Prefer searchMeta / canonical keys over flattening arbitrary version metadata
- [ ] When validity is inferred (anchor + prazo), surface that honestly; if no base, show “não determinada”
- [ ] Keep system fields already shown (category, uploader, dates, version)

### Out of Scope (this milestone)

- Full exclusive Documento ↔ Ficha mode switch (deferred; enriching Detalhes first)
- Audit/P1 hardening (removed from GSD; may return later)
- Redesigning extraction rules / AI prompts beyond what Detalhes needs to display

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
