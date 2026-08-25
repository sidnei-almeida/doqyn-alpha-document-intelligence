/**
 * Padrão visual do módulo Configurações.
 *
 * Navegação — duas seções, por quem decide, sem sub-abas:
 * - Minha conta (pessoal) · Organização (tenant, `company_admin` em PJ)
 * - O índice fica na coluna da esquerda; a URL carrega só `?section=`.
 * - A seção "Sistema" (infraestrutura, storage, auth) saiu: era promessa de conteúdo, não
 *   configuração. `?section=sistema` e `?section=seguranca` caem em Minha conta.
 *
 * Layout — coluna única de leitura:
 * - `settings-shell`: índice (14–17,5rem) + conteúdo; abaixo de 1024px o índice empilha.
 * - `settings-layout__content` tem medida de texto (46rem). Nada de segunda coluna de
 *   conteúdo ao lado do índice: a tela lê de cima para baixo.
 * - Sem moldura: o conteúdo senta no canvas (`settings-content-panel` não tem borda).
 *
 * Bloco — um assunto por bloco, separados por fio:
 * - `settings-blocks` > `settings-block`, com `border-top` entre irmãos.
 * - `settings-block__header` traz título e descrição do assunto; o título da seção
 *   fica só no `PageShell` (uma hierarquia de cabeçalho, não duas).
 * - Dentro do bloco: `SettingsRowList`/`SettingsRow` (rótulo à esquerda, controle à
 *   direita), `SettingsRegisterList` para atalhos, `settings-callout` para nota.
 *
 * Uma regra de salvamento por tela, declarada na própria tela (`settings-save-rule`):
 * - Minha conta: cada mudança vale na hora; senha e e-mail são ações com confirmação própria.
 * - Organização: nada vale até salvar. O rascunho dos três blocos vive em
 *   `useOrganizationSettings`, e uma única `SettingsSaveBar` (`--screen`, fixa no fim da
 *   coluna) salva só o que mudou. Blocos não têm botão de salvar próprio.
 *   "Enviar teste" do SMTP é ação, não configuração, e só vale sobre o que já foi salvo.
 *
 * Permissão:
 * - `governsOrganization({ tenantType, isCompanyAdmin })` decide quem edita; em PF o dono
 *   governa. Quem não governa em PJ ainda vê Envio e IA em leitura (`fieldset disabled`),
 *   porque é o bloco que explica o que a IA fez com o arquivo dele.
 * - O front só esconde: todo endpoint de configuração de tenant nasce com 403 no servidor.
 */
export const SETTINGS_UI_PATTERN = {
  pageEyebrow: 'Configurações',
  contentMaxWidth: '46rem',
  blockGap: '1.75rem',
  sectionBodyGap: '1rem',
  rowMinHeight: '3.25rem',
} as const;
