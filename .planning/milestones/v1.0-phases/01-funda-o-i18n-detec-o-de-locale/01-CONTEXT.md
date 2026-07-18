# Phase 1: Fundação i18n + detecção de locale - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

O app carrega através de um runtime de i18n com catálogos para pt-BR, es-PY e en-US; na primeira
visita o idioma é detectado do navegador (fallback pt-BR) e o `<html lang>` reflete o locale ativo.
A infraestrutura funciona ponta a ponta com o shell/navegação migrados. Requisitos: I18N-01..04
(ver `.planning/REQUIREMENTS.md`).

Fora desta fase: seletor de idioma na UI (Fase 2), formatação de data/número (Fase 3),
identificadores/telefone por país (Fases 4/5), tradução total do app.
</domain>

<decisions>
## Implementation Decisions

### Locked
- Runtime: `react-i18next` + `i18next` (padrão de mercado, integra com React 19; suporta detecção de idioma e namespaces).
- Locales suportados: `pt-BR` (fallback), `es-PY`, `en-US`.
- Detecção na 1ª visita a partir de `navigator.language`/`navigator.languages`, mapeando para o locale suportado mais próximo (ex.: `es`, `es-*` → es-PY; `en`, `en-*` → en-US; resto → pt-BR).
- Catálogos organizados por namespace JSON em `src/i18n/locales/<locale>/<namespace>.json` (ex.: `common`, `nav`). Fallback de chave ausente → pt-BR.
- `<html lang>` atualizado dinamicamente ao trocar o locale ativo.
- Persistência de escolha explícita fica para a Fase 2; nesta fase basta detecção + init.

### Claude's Discretion
Estrutura de arquivos do módulo i18n, escolha de plugins (`i18next-browser-languagedetector` é permitido),
e quais strings exatas do shell/navegação migrar primeiro. Seguir convenções do codebase e do design system.
</decisions>

<code_context>
## Existing Code Insights

- Sem framework de i18n hoje. `<html lang="pt-BR">` em `index.html`.
- Providers do app: `src/app/providers.tsx`; entrada `src/main.tsx` → `src/app/App.tsx`.
- Shell/layout: `src/components/layout/*`, `src/app/layout/WorkspaceLayout.tsx`, `src/components/layout/AppLayout.tsx`.
- Alias `@` → `src`. React 19.1, Vite 6.3, TanStack Query. Testes via `tsx --test tests/**/*.test.ts`.
- Strings de UI hoje hardcoded em português por todo o `src/`.
</code_context>

<specifics>
## Specific Ideas

- Criar `src/i18n/` com `index.ts` (init do i18next), `config.ts` (locales suportados, mapeamento de detecção), e `locales/<locale>/*.json`.
- Envolver o app com o provider do react-i18next em `src/app/providers.tsx`.
- Efeito para sincronizar `document.documentElement.lang` com o locale ativo.
- Migrar as strings do shell/navegação (menu lateral, topbar) para `t()` com chaves no namespace `nav`/`common`, preenchendo os 3 idiomas.
- Adicionar teste(s) em `tests/` para o mapeamento de detecção de locale (unidade, sem DOM).
</specifics>

<deferred>
## Deferred Ideas

- Seletor de idioma na UI + persistência → Fase 2.
- Formatação de data/número por locale → Fase 3.
- Identificadores e telefone por país → Fases 4/5.
- Tradução das superfícies restantes → incremental, fora da milestone.
</deferred>
