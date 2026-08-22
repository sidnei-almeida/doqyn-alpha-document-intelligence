# Retomada — tracking documental

Escrito ao pausar em 2026-08-13, para ser retomado sem o contexto da sessão.

## Onde paramos

O escopo aprovado foi **dossiê do documento + exportação + integridade**. Só a integridade saiu.

| Fase | Estado |
|---|---|
| Cadeia de integridade | **Pronta e verificada** (commit `963d23f`) |
| Contrato rico da timeline | não começou |
| Aba "Quem acessou" (agregação por pessoa) | não começou |
| Exportação CSV/PDF da trilha | não começou |
| UI do dossiê | não começou |

## O que já existe e não precisa ser refeito

O backend **já coleta** muito mais do que a interface mostra. Cada evento gravado carrega ator com
snapshot de nome/e-mail/papéis e um `securityContext` com IP mascarado, hash de IP, país, região,
cidade, fuso, hash de sessão, método de autenticação, navegador, SO, tipo de dispositivo, flag de
convidado externo e resultado de permissão. São ~90 ações no enum e 86 pontos de emissão.

O gargalo está em dois lugares:

1. **`listDocumentTimeline`** (`server/audit/documentAuditLogService.ts`) devolve `summary`,
   `severity`, ator, `changes` e um `metadata` sanitizado. Todo o `securityContext` vira sopa dentro
   de `metadata`, sem contrato — quem consome não sabe que existe.
2. **`src/features/documents/DocumentTimeline.tsx`** são 102 linhas: cartão com frase, badge da
   severidade crua e, ao expandir, `<pre>{JSON.stringify(metadata)}</pre>`.

A `TrackingPage` do tenant (filtros, tabela, drawer, faixa de resumo) já é bem mais rica — o buraco é
o dossiê **por documento**, que é o que o cliente abre para perguntar "o que aconteceu com este
contrato?".

## Próximo passo sugerido

Começar pelo contrato: estender `DocumentTimelineItem` com `actionGroup`, `status`, `context`
(ip mascarado, geo, dispositivo, navegador, sessão, autenticação, convidado externo) e `actor` com
papéis, além de aceitar filtros por período, ator, grupo de ação e status. A UI vem depois, e a
agregação "quem acessou" reaproveita a mesma consulta.

## Cadeia de integridade — como funciona

Cada evento carrega `chain = { algo, version, seq, prevHash, hash }`, com
`hash = sha256(prevHash + payload canônico)`. O ponteiro por tenant vive em `audit_chain_heads` e
avança por compare-and-swap sobre `seq`.

```bash
GET /api/tracking/verify-chain     # exige quem governa o tenant
# -> { ok, verified, legacy, unchained, expectedSeq, headHash, breaks[] }
```

Três armadilhas que já custaram tempo e estão resolvidas — não reintroduzir:

- **Ausência e nulo são a mesma coisa no hash.** O driver grava `undefined` como `null`; distinguir
  os dois fazia todo evento com `securityContext` acusar adulteração falsa.
- **A fórmula é versionada no próprio evento.** Mudar o que entra no hash exige subir
  `AUDIT_CHAIN_VERSION`, nunca reescrever a fórmula em silêncio.
- **Evento sem `chain.version`** é anterior à convenção e não é reproduzível: conta como `legacy`,
  não como quebra.

## Ambiente

Conta demo **Meridiano Engenharia e Projetos Ltda.** (`company_meridiano_engenharia_e_proje_933a5e`),
CNPJ `47215806000160`, senha `DevDoqyn@123` para todos:

| E-mail | Papel | Grupo |
|---|---|---|
| `helena.vasconcelos@meridiano-eng.dev` | company_admin | Diretoria |
| `ricardo.nunes@meridiano-eng.dev` | company_admin | Diretoria |
| `marcos.tavares@meridiano-eng.dev` | user | Engenharia |
| `juliana.prado@meridiano-eng.dev` | user | Financeiro |

4 grupos, 4 classes com uma regra ativa cada, 2 documentos analisados, 66 eventos de trilha.

**Cuidado com a suíte do auth-service:** ela apaga todas as tabelas. Desde o commit `0b23bf6` ela se
recusa a rodar contra banco sem "test" no nome, e existe um `doqyn_auth_test` com as migrações
aplicadas. Para rodar: `DATABASE_URL=<...>/doqyn_auth_test npx vitest run`.

## Pendências abertas desta sessão

- **`tenants.slug` tem índice único global.** Duas empresas com o mesmo nome não coexistem — foi o
  que barrou recriar a demo com o nome anterior. Decisão de produto: o slug provavelmente deveria ser
  único por tenant, ou não ser único.
- **Bucket R2 órfão** da demo antiga (`doqyn-dev-t-company-vertex-...`) continua no Cloudflare. Os
  dados do tenant já saíram do Mongo; o bucket some junto do item 3 de
  `PENDENCIAS-ABERTAS-2026-08-13.md`.
- **Sem tela de compartilhamentos ativos do tenant** — ver `AUDITORIA-DESLIGAMENTO.md`.
