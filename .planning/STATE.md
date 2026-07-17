# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-17)

**Core value:** Tenants can securely upload, analyze, and manage documents — expandindo para múltiplos países.
**Current focus:** Internacionalização e multi-país (BR / PY / US) — i18n + identificadores/telefone por país

## Current Position

Phase: 1 — Fundação i18n + detecção de locale
Plan: —
Status: Ready to plan (autonomous, discuss skipped)
Last activity: 2026-07-17 — Nova milestone i18n/multi-país definida; milestone Viewer Detalhes deferida (0%, não iniciada)

Progress: [░░░░░░░░░░] 0%

## Accumulated Context

### Decisions

- Expansão para Paraguai (es-PY) e Estados Unidos (en-US), mantendo Brasil (pt-BR) como fallback.
- Runtime de i18n escolhido: `react-i18next` (padrão, robusto, integra com React 19).
- Idioma persiste em localStorage nesta milestone; sync com perfil no `doqyn-auth-service` fica deferido.
- Identificadores por país: BR CPF/CNPJ, PY CI/RUC, US SSN/EIN. Telefone: BR +55, PY +595, US +1 (E.164).
- Escopo de tradução v1: shell/navegação, autenticação/cadastro, biblioteca, visualizador — tradução total é incremental.
- Executando em modo autônomo com `skip_discuss=true` e `ui_phase=false` (sem interrupções ao usuário).

### Pending Todos

- Executar as 5 fases da milestone i18n autonomamente.

### Blockers/Concerns

- Nenhum bloqueio conhecido. Ponto de atenção: validação de dígito verificador de RUC (PY) e regras de SSN/EIN (US) devem ser de formato, sem depender de serviços externos.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Product | Milestone "Viewer — Detalhes com metadados standard" (VIEW-01..06) | deferred | 2026-07-17 |
| Product | Exclusive Documento ↔ Ficha viewer mode | deferred | 2026-07-15 |
| Infra | Audit P1 hardening | deferred | 2026-07-15 |
| i18n | Persistir idioma no perfil do usuário (auth-service) | deferred | 2026-07-17 |
| i18n | Tradução 100% do app (superfícies restantes) | deferred | 2026-07-17 |

## Session Continuity

Last session: 2026-07-17
Stopped at: Milestone i18n/multi-país criada; iniciando execução autônoma da Fase 1
Resume file: None
