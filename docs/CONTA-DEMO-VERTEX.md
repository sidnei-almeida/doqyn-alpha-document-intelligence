# Conta demo — Vertex Engenharia (empresa PJ)

Empresa de teste criada em 2026-08-13 pelo fluxo real do produto, sem escrita direta em banco:
cadastro pela API pública do `doqyn-auth-service`, provisionamento automático do ambiente no
MongoDB, governança configurada pelos mesmos endpoints que a tela `/rules` usa, e três documentos
enviados pelo pipeline de análise da IA.

Serve para exercitar o produto com um tenant que não é o `company_dev` do seed.

## Acesso

Senha de todos: `DevDoqyn@123` — a mesma das outras contas demo.

| E-mail | Nome | Papel | Grupo documental |
|---|---|---|---|
| `helena.vasconcelos@vertex-engenharia.dev` | Helena Vasconcelos | `company_admin` | Diretoria |
| `ricardo.nunes@vertex-engenharia.dev` | Ricardo Nunes | `company_admin` | Diretoria |
| `marcos.tavares@vertex-engenharia.dev` | Marcos Tavares | `user` | Engenharia |
| `juliana.prado@vertex-engenharia.dev` | Juliana Prado | `user` | Financeiro |

Helena criou a empresa; os outros três entraram por convite (`POST /auth/invites` seguido de
`/auth/invites/:token/accept`), que é o caminho real de entrada de funcionário.

## Identidade do tenant

| Campo | Valor |
|---|---|
| `tenantId` | `company_vertex_engenharia_e_projetos_0d6dd3` |
| Razão social | Vertex Engenharia e Projetos Ltda. |
| CNPJ | `62481937000183` (dígitos verificadores válidos, empresa fictícia) |
| Tipo | `business` |
| Bucket R2 | `doqyn-dev-t-company-vertex-engenharia-e-projetos-0-8b1c9bb89c20` |

## Governança configurada

Quatro classes documentais, cada uma com **uma** regra de extração ativa:

| Classe | Campos extraídos | Template de nome |
|---|---|---|
| Contratos | fornecedor, data de assinatura | `Contrato_{fornecedor}_{data_assinatura}_v{version}` |
| Financeiro | fornecedor, número da nota, data de emissão | `Fiscal_{fornecedor}_{numero_nota}_{data_emissao}_v{version}` |
| Jurídico | parte reveladora, parte receptora, data de assinatura | `NDA_{parte_reveladora}_e_{parte_receptora}_{data_assinatura}_v{version}` |
| Projetos de Engenharia | título, referência, data de assinatura | `{referencia}_{titulo}_{data_assinatura}_v{version}` |

Matriz de acesso: Diretoria enxerga tudo com permissão total. Engenharia tem posse de Projetos e
leitura de Contratos. Financeiro tem posse de Financeiro e leitura de Contratos. Jurídico tem posse
de Jurídico e de Contratos.

## Documentos já enviados

| Código | Classe | Enviado por | Observação |
|---|---|---|---|
| `DOQYN-2026-000001` | Contratos | Marcos Tavares | classificação 0.99, 3 campos extraídos |
| `DOQYN-2026-000002` | Jurídico | Helena Vasconcelos | `requires_review` — extração falhou por timeout |
| `DOQYN-2026-000003` | Jurídico | Juliana Prado | mesmo PDF do anterior, 5 campos extraídos |

Os três binários estão no **mesmo bucket da empresa**, incluindo os que funcionários sem cargo de
administrador enviaram — o documento pertence ao tenant, não à pessoa. Preview gerado nos três.

## Dois achados registrados durante a criação

**Empresa nova não consegue analisar documento até configurar governança.** O primeiro upload
devolveu `503 DOCUMENT_RULES_NOT_CONFIGURED`. É comportamento deliberado, protegido por
`tests/tenant-no-default-groups.test.ts`: o tenant nasce sem classes e sem grupos, e o admin
precisa criá-los em `/rules` antes do primeiro envio. Vale confirmar se o onboarding conduz o
cliente até essa tela — sem isso o produto parece quebrado no primeiro uso.

**Criar classe já cria uma regra de extração rascunho.**
`createDefaultExtractionRuleForCategory` (`server/services/documentExtractionRulesService.ts`) roda
junto da criação da categoria. Se o admin também criar uma regra pela API/UI, a classe fica com
duas regras ativas de mesma `version`, e `mapCategoryExtractionRules`
(`server/services/documentRulesService.ts:87`) resolve o empate ficando com a **primeira da ordem
natural do Mongo** — ou seja, qual regra vale passa a ser indeterminado. Neste tenant o estado foi
normalizado para uma regra ativa por classe.

## Recriar do zero

Os scripts ficaram fora do repositório por serem de uso único. Para refazer:

1. `POST /auth/company-signups` com CNPJ válido, `acceptedTermsVersion: 'v1.0-dev'`.
2. `POST /auth/invites` + `POST /auth/invites/:token/accept` por funcionário — em dev a resposta do
   convite traz `inviteToken`, então não depende de SMTP.
3. `POST /api/document-groups`, `POST /api/document-categories`, `PATCH
   /api/document-extraction-rules/:id`, `PUT /api/document-rules/matrix`,
   `POST /api/document-groups/:id/members`.
4. `POST /api/ai/analyze-pdf` (multipart) seguido de `POST /api/documents/confirm-analysis`. Quando
   a IA devolve `requires_review` antes da extração, `extraction` vem `null` e o confirm recusa o
   payload — o frontend resolve isso em `normalizeAnalyzePayloadForConfirm`.
