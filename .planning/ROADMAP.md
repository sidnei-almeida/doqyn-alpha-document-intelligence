# Roadmap: Internacionalização e multi-país (BR / PY / US)

## Overview

Dar ao app uma fundação de i18n (seleção + detecção automática de idioma) e uma camada de
identificadores/telefone dirigida por país, para viabilizar a expansão para Paraguai (es-PY)
e Estados Unidos (en-US) mantendo o Brasil (pt-BR) sem regressões. Escopo: fundação + superfícies
de maior valor (shell/navegação, autenticação/cadastro, biblioteca, visualizador). Tradução total
do app é incremental e fora desta milestone.

## Phases

- [x] **Phase 1: Fundação i18n + detecção de locale** — runtime i18n, provider, catálogos pt-BR/es-PY/en-US, auto-detecção e `<html lang>` dinâmico (completed 2026-07-17)
- [x] **Phase 2: Seletor de idioma + persistência** — componente de troca de idioma (header + configurações), persistência em localStorage sobrepondo auto-detecção (completed 2026-07-17)
- [x] **Phase 3: Formatação sensível a locale** — util/hook central de data/número; migrar usos hardcoded `pt-BR` (completed 2026-07-17)
- [ ] **Phase 4: Identificadores fiscais por país** — registro por país (CPF/CNPJ, CI/RUC, SSN/EIN) + integração no cadastro/revisão
- [ ] **Phase 5: Telefone por país + integração no cadastro** — entrada de telefone multi-país (E.164) + normalização no servidor + tradução das telas de cadastro/auth

## Phase Details

### Phase 1: Fundação i18n + detecção de locale
**Goal**: O app carrega através de um runtime de i18n com catálogos para pt-BR, es-PY e en-US; na primeira visita o idioma é detectado do navegador (fallback pt-BR) e o `<html lang>` reflete o locale ativo. Nenhuma tradução visível ainda precisa cobrir 100% do app, mas a infraestrutura funciona ponta a ponta com o shell/navegação migrados.
**Depends on**: Nothing
**Requirements**: I18N-01, I18N-02, I18N-03, I18N-04
**Success Criteria**:
  1. `react-i18next` instalado; `LocaleProvider`/init de i18n envolve o app em `src/app/providers.tsx` sem quebrar build/lint/`npm test`.
  2. Catálogos `pt-BR`, `es-PY`, `en-US` existem, organizados por namespace, com fallback para pt-BR.
  3. Detecção via `navigator.language(s)` mapeia para locale suportado na 1ª visita; locale não suportado cai em pt-BR.
  4. `<html lang>` muda dinamicamente conforme o locale ativo.
  5. As strings do shell/navegação (layout principal/topbar/menu) passam por `t()` e aparecem traduzidas nos 3 idiomas.
**Plans**: 3 plans
  - [x] 01-01-PLAN.md — Deps + config/detecção (resolveSupportedLocale) + teste unitário [I18N-01, I18N-02, I18N-03]
  - [x] 01-02-PLAN.md — Catálogos common/nav (pt-BR/es-PY/en-US) + init do i18next com fallback pt-BR [I18N-02, I18N-03]
  - [x] 01-03-PLAN.md — I18nextProvider + `<html lang>` dinâmico + migração shell/nav para t() [I18N-01, I18N-04]

### Phase 2: Seletor de idioma + persistência
**Goal**: Usuário pode trocar o idioma por um seletor no header e nas Configurações; a escolha persiste entre sessões e sobrepõe a auto-detecção; a troca reflete imediatamente sem reload.
**Depends on**: Phase 1
**Requirements**: SEL-01, SEL-02, SEL-03
**Success Criteria**:
  1. Componente de seleção de idioma disponível no header/topbar e na tela de Configurações, reusando o design system existente (`src/components/ui/*`).
  2. Escolha persiste em localStorage e é lida na inicialização com precedência sobre a auto-detecção do navegador.
  3. Trocar o idioma re-renderiza a UI imediatamente (sem reload), incluindo `<html lang>`.
**Plans**: 2 plans
  - [x] 02-01-PLAN.md — Persistência (localePreference) + precedência no init do i18next + hook useLocale + chaves language.* [SEL-02, SEL-03]
  - [x] 02-02-PLAN.md — Componente LanguageSelect reusável + wiring no header e nas Configurações + teste [SEL-01, SEL-03]

### Phase 3: Formatação sensível a locale
**Goal**: Datas, horas e números são formatados pelo locale ativo através de um util/hook central; os usos hardcoded de `'pt-BR'` migram para ele, sem regressão visual no fluxo BR.
**Depends on**: Phase 1
**Requirements**: FMT-01, FMT-02, FMT-03
**Success Criteria**:
  1. Existe um util/hook central de formatação (data/hora/número) que usa o locale ativo do i18n.
  2. Os ~20+ usos hardcoded de `toLocale*('pt-BR')` / `Intl.*('pt-BR')` em `src/` migram para o util central (ou recebem o locale ativo).
  3. Em pt-BR o resultado permanece idêntico ao atual; em es-PY/en-US datas e números aparecem no formato local.
**Plans**: 3 plans
  - [x] 03-01-PLAN.md — Módulo central formatLocale + hook useLocaleFormatters + delega utils.ts + testes [FMT-01, FMT-02]
  - [x] 03-02-PLAN.md — Migra document-send + sharing + document-update-version para formatLocale [FMT-01, FMT-03]
  - [x] 03-03-PLAN.md — Migra library sortDocuments + signature + external-share para formatLocale [FMT-01, FMT-02, FMT-03]

### Phase 4: Identificadores fiscais por país
**Goal**: Um registro de identificadores por país substitui o `taxId.ts` BR-only, cobrindo CPF/CNPJ (BR), CI/RUC (PY) e SSN/EIN (US) com rótulo, máscara, placeholder, normalização e validação; os formulários de cadastro selecionam o país e mostram o campo de documento correto; a revisão exibe o documento formatado por país.
**Depends on**: Phase 1
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05
**Success Criteria**:
  1. Registro de identificadores por país (BR/PY/US) com config por país para ID pessoa física e jurídica (rótulo, máscara, placeholder, normalize, validate).
  2. BR mantém CPF/CNPJ com comportamento atual preservado (formatação e validação existentes).
  3. PY (CI/RUC) e US (SSN/EIN) formatam, mascaram e validam formato/dígito verificador quando aplicável.
  4. Cadastro individual e de empresa selecionam país e exibem o campo/rótulo/máscara/validação corretos.
  5. `reviewDisplay` e telas de revisão exibem o documento formatado por país, mantendo o mascaramento de dados sensíveis do ID pessoal.
**Plans**: 3 plans
  - [ ] 04-01-PLAN.md — Registro countryIdentifiers.ts (BR/PY/US specs) + validação CPF/CNPJ/RUC mod-11 + SSN/EIN + defaultCountryForLocale + testes (regressão BR) [DOC-01, DOC-02, DOC-03]
  - [ ] 04-02-PLAN.md — DocumentIdInput + CountrySelect + generalização reviewDisplay (mascaramento por país, back-compat BR) + catálogos i18n identifiers [DOC-01, DOC-03, DOC-05]
  - [ ] 04-03-PLAN.md — Integração no cadastro individual + empresa (seletor de país, campo/rótulo dinâmico, payload normalizado, revisão por país) + testes [DOC-04, DOC-05]

### Phase 5: Telefone por país + integração no cadastro
**Goal**: A entrada de telefone funciona para BR (+55), PY (+595) e US (+1) com máscara e valor E.164 corretos; um seletor de DDI aparece nos formulários com default alinhado ao país ativo; o servidor normaliza E.164 multi-país; as telas de cadastro/auth ficam traduzidas nos 3 idiomas.
**Depends on**: Phase 1, Phase 4
**Requirements**: TEL-01, TEL-02, TEL-03
**Success Criteria**:
  1. Entrada de telefone generalizada por país (BR/PY/US) produz E.164 correto por DDI, preservando o comportamento BR atual.
  2. Seletor de país/DDI nos formulários de cadastro, com default vindo do locale/país ativo.
  3. `server/utils/contactNormalize.ts` aceita e normaliza E.164 multi-país sem assumir +55, sem quebrar o fluxo BR.
  4. Strings de cadastro/autenticação passam por `t()` e aparecem traduzidas em pt-BR/es-PY/en-US.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundação i18n + detecção de locale | 3/3 | Complete   | 2026-07-17 |
| 2. Seletor de idioma + persistência | 2/2 | Complete   | 2026-07-17 |
| 3. Formatação sensível a locale | 3/3 | Complete   | 2026-07-17 |
| 4. Identificadores fiscais por país | 0/3 | Not started | - |
| 5. Telefone por país + integração no cadastro | 0/TBD | Not started | - |
