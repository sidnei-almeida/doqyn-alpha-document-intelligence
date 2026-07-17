# Requirements: Internacionalização e multi-país (BR / PY / US)

## Context

O app é hoje inteiramente pt-BR e assume padrões brasileiros: `<html lang="pt-BR">`,
strings de UI hardcoded em português, `toLocaleString('pt-BR')` espalhado (~20+ locais),
identificadores fiscais só de BR (`src/lib/identifiers/taxId.ts` = CPF/CNPJ) e telefone
centrado no Brasil (`src/lib/identifiers/whatsapp.ts` = +55 default, `server/utils/contactNormalize.ts`).

Expansão para **Paraguai** (es-PY) e **Estados Unidos** (en-US) exige uma fundação de i18n
e uma camada de identificadores/telefone dirigida por país.

## Supported locales & countries (v1)

| País | Locale | Idioma | ID pessoa física | ID pessoa jurídica | DDI telefone |
|------|--------|--------|------------------|--------------------|--------------|
| Brasil | `pt-BR` | Português | CPF (11 díg.) | CNPJ (14 díg.) | +55 |
| Paraguai | `es-PY` | Español | CI / Cédula (numérica) | RUC (com dígito verificador) | +595 |
| Estados Unidos | `en-US` | English | SSN (XXX-XX-XXXX) | EIN (XX-XXXXXXX) | +1 |

Idioma padrão de fallback: `pt-BR`.

## v1 Requirements

### i18n foundation (I18N)

- [x] **I18N-01**: Runtime de i18n instalado e configurado (react-i18next) com um `LocaleProvider` envolvendo o app; sem quebra de build/tests.
- [x] **I18N-02**: Catálogos de mensagens para `pt-BR`, `es-PY` e `en-US`, organizados por namespace (ex.: `common`, `auth`, `library`, `viewer`). pt-BR completo; es-PY/en-US com as chaves cobertas nesta milestone (fallback para pt-BR quando ausente).
- [x] **I18N-03**: Detecção automática de idioma na primeira visita a partir de `navigator.language`/`navigator.languages`, mapeando para um locale suportado (fallback pt-BR quando não suportado).
- [x] **I18N-04**: `<html lang>` reflete dinamicamente o locale ativo.
- [ ] **I18N-05**: Nenhuma string traduzida hardcoded nas superfícies migradas — todas passam pela função de tradução `t()`.

### Language / country selector (SEL)

- [x] **SEL-01**: Componente de seleção de idioma acessível a partir do header/topbar e das Configurações.
- [x] **SEL-02**: A preferência de idioma escolhida persiste entre sessões (localStorage) e sobrepõe a auto-detecção.
- [x] **SEL-03**: Trocar o idioma atualiza a UI imediatamente, sem reload de página.

### Locale-aware formatting (FMT)

- [x] **FMT-01**: Formatação de data/hora passa a usar o locale ativo (não mais `'pt-BR'` hardcoded) via util/hook central.
- [x] **FMT-02**: Formatação de números/ordenação (`localeCompare`, `Intl.NumberFormat`) usa o locale ativo.
- [x] **FMT-03**: Os ~20+ usos hardcoded de `toLocale*('pt-BR')` / `Intl.*('pt-BR')` migram para o util central (ou recebem o locale ativo).

### Country-aware fiscal identifiers (DOC)

- [x] **DOC-01**: `taxId.ts` generalizado em um registro de identificadores por país: cada país define rótulo, máscara, placeholder, normalização e validação para ID pessoa física e pessoa jurídica.
- [x] **DOC-02**: Brasil mantém CPF/CNPJ (comportamento atual preservado, incluindo dígitos verificadores quando já existirem).
- [x] **DOC-03**: Paraguai (CI/RUC) e EUA (SSN/EIN) suportados com máscara + placeholder + validação de formato/dígito verificador quando aplicável.
- [x] **DOC-04**: Formulários de cadastro (individual e empresa) selecionam o país e exibem o campo de documento correto (rótulo, máscara, validação) conforme o país.
- [x] **DOC-05**: `reviewDisplay`/telas de revisão exibem o documento formatado corretamente por país (mascarando dados sensíveis do ID pessoal como hoje ocorre com CPF).

### Country-aware phone (TEL)

- [x] **TEL-01**: `whatsapp.ts`/entrada de telefone generalizada por país (BR +55, PY +595, US +1) com máscara/format e valor E.164 correto por DDI.
- [ ] **TEL-02**: Seletor de país (DDI) na entrada de telefone dos formulários de cadastro; default alinhado ao locale/país ativo.
- [x] **TEL-03**: `server/utils/contactNormalize.ts` aceita e normaliza números E.164 multi-país (não assume +55) sem quebrar o fluxo BR atual.

## Out of Scope (this milestone)

- Tradução 100% de todas as strings do app — a fundação habilita tradução incremental; esta milestone cobre o shell/navegação, autenticação/cadastro, biblioteca e visualizador. Strings restantes ficam para incrementos futuros.
- Persistir o idioma no perfil do usuário no `doqyn-auth-service` (repo irmão) — v1 persiste em localStorage; sync de perfil fica deferido.
- Tradução de conteúdo gerado por IA / prompts de extração.
- Moeda/faturamento multi-país (billing) — fora do escopo.
- Novos países além de BR/PY/US.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| I18N-01 … I18N-05 | 1 | Pending |
| SEL-01 … SEL-03 | 2 | Pending |
| FMT-01 … FMT-03 | 3 | Pending |
| DOC-01 … DOC-05 | 4 | Pending |
| TEL-01 … TEL-03 | 5 | Pending |

## Definition of Done

- Um usuário com navegador em espanhol/inglês vê o app no idioma correto na primeira visita, e pode trocar manualmente com persistência.
- Datas/números aparecem no formato do locale ativo.
- Cadastro funciona para BR, PY e US com o documento e telefone corretos (rótulo, máscara, validação, E.164).
- O fluxo brasileiro existente continua funcionando sem regressões (CPF/CNPJ, +55, pt-BR).
- Build, lint e testes (`npm test`) passam.
