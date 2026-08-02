# DOQYN Alpha — Document Intelligence

## What This Is

A multi-tenant SaaS platform for document management with AI-assisted classification, metadata extraction, e-signature, sharing, and governance workflows, now expanding beyond Brazil into Paraguay and the United States. React 19 SPA + Vercel-style Node API, MongoDB, Redis/BullMQ, Cloudflare R2. Auth via sibling `doqyn-auth-service`. i18n via `react-i18next` (pt-BR/es-PY/en-US).

## Core Value

Tenants can securely upload, analyze, and manage documents — and understand what matters in a document without reading the full file — regardless of which of the supported countries (Brasil, Paraguai, Estados Unidos) they operate in.

## Requirements

### Validated

- ✓ Document upload → AI classification/metadata → tenant-scoped Mongo persistence
- ✓ Canonical metadata key normalization (`shared/metadataKeyNormalize.ts`)
- ✓ `documents.searchMeta` projection (people, dates, title, validityDate including prazo-inferred) via `projectDocumentSearchMeta`
- ✓ Document viewer with Details aside (`DocumentViewerDetailsPanel`)
- ✓ i18n runtime (react-i18next) with pt-BR/es-PY/en-US catalogs, browser-language auto-detection with pt-BR fallback, dynamic `<html lang>` — v1.0
- ✓ Language selector (header + Settings) with localStorage persistence overriding auto-detection, no-reload switching — v1.0
- ✓ Locale-aware date/number formatting via central `formatLocale.ts`, migrated ~20 hardcoded `pt-BR` call sites — v1.0
- ✓ Country-aware fiscal identifier registry (BR CPF/CNPJ, PY CI/RUC, US SSN/EIN) with format/validate/mask, wired into individual + company signup and review — v1.0
- ✓ Country-aware phone entry (BR +55, PY +595, US +1) in E.164, DDI selector in signup, `contactNormalize.ts` generalized server-side without breaking BR — v1.0
- ✓ Auth/signup surfaces (Login, individual signup, company signup — including review dialogs and validation errors) fully translated in 3 locales — v1.0

### Active

*(No active milestone — run `/gsd:new-milestone` to start the next one.)*

### Out of Scope

- Tradução 100% do app além de shell/nav, auth/cadastro — Library, Viewer, and some pre-existing Settings/HeaderUserMenu strings remain pt-BR hardcoded. Incremental, revisit when a concrete need surfaces (e.g. a PY/US tenant flags it).
- Persistir idioma no perfil do usuário no `doqyn-auth-service` (repo irmão) — v1.0 usa localStorage only; cross-repo profile sync deferred.
- `WhatsappInput` (BR-only) still used in share/signature/access-request/invite flows — country-aware `PhoneInput` only reached signup. Generalizing the remaining 4 callers is deferred.
- Backend (`doqyn-auth-service`) acceptance/validation of non-BR documents and phones — client sends correct normalized payloads; sibling-repo validation may need a follow-up.
- Billing/moeda multi-país e novos países além de BR/PY/US.
- Milestone "Viewer — Detalhes com metadados standard" (deferida, pre-dates this milestone).

## Context

- Shipped v1.0 "Internacionalização e multi-país (BR/PY/US)" on 2026-07-18 — 5 phases, 15 plans, 37 tasks, 72 commits, +8844/-480 LOC across 131 files. See `.planning/milestones/v1.0-ROADMAP.md` and `.planning/MILESTONES.md`.
- Previous Claude Code GSD cycle (Audit Hardening P1) was discarded 2026-07-15 — not product direction.
- Codebase map: `.planning/codebase/*`
- Standard field vocabulary: `CANONICAL_METADATA_LABELS` + `projectSearchMeta` person/date roles
- i18n module: `src/i18n/` (config, index, localePreference, useLocale, useDocumentLang, locales/{pt-BR,es-PY,en-US}/{common,nav,identifiers,auth}.json)
- Country/identifier/phone registries: `src/lib/identifiers/{countryIdentifiers,phone,taxId,whatsapp}.ts`
- Locale-aware formatting: `src/lib/formatLocale.ts`, `src/lib/useLocaleFormatters.ts`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| react-i18next as the i18n runtime | De-facto standard, official React bindings, integrates cleanly with React 19 | ✓ Good |
| localStorage-only locale persistence (no auth-service profile sync) for v1.0 | Avoids cross-repo coupling in a first pass; sync can follow once the pattern is proven | ✓ Good |
| Country-aware identifier/phone registries keyed by `CountryCode`/`PersonType`, BR delegates to existing `taxId.ts`/`whatsapp.ts` | Zero behavior change for the existing BR-only flows while adding PY/US | ✓ Good |
| Scope translation to shell/nav + auth/signup only, not the full app | Matches actual near-term value (new-country onboarding) vs. a much larger, lower-value full-app translation effort | ✓ Good |
| `PhoneInput`/`DocumentIdInput` reused only in signup, not share/signature/access-request/invite | Kept the milestone bounded; those flows stay BR-only until a country need is confirmed | ✓ Good (deferred, documented) |
| Milestone audit (integration checker) run before completion, not skipped | Caught 2 real regressions (Node.js built-in `navigator` breaking locale detection in Node contexts; untranslated signup review dialog) that phase-level verification missed | ✓ Good — recommend keeping this gate for future milestones |
| Enrich Details panel first (not full Ficha mode) — pre-dates this milestone | Lower UX risk; reuses existing aside | Pending (deferred milestone) |

## Evolution

Update at phase / milestone boundaries via GSD workflows.

---
*Last updated: 2026-07-18 — v1.0 Internacionalização e multi-país (BR/PY/US) shipped*
