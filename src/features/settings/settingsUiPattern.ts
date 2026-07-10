/**
 * Padrão visual do módulo Configurações (camada estrutural compartilhada).
 *
 * Navegação (menu lateral — 4 itens):
 * - Perfil → sub-abas: Identidade · Preferências · Acesso
 * - Upload e IA
 * - Segurança
 * - Empresa → sub-abas: Governança · Retenção (admin) · Sistema
 * URLs legadas (?section=preferencias, autenticacao, organizacao, lixeira, sistema)
 * redirecionam para a seção composta + ?tab= correspondente.
 *
 * Hierarquia de cabeçalho (uma só):
 * - PageShell: eyebrow "Configurações" + título/descrição da seção ativa
 * - Painel de conteúdo: sem segundo cabeçalho (evita "Administração / Configurações"
 *   + "Configurações da conta / [seção]")
 * - SettingsSectionHeader: só para subtítulos internos raros; não repetir o título da seção
 *
 * Cards e densidade:
 * - settings-cards-grid: grade auto-fit; cards crescem com o conteúdo (align-items: start)
 * - settings-cards-grid--balanced: flex wrap com flex-grow (última linha preenche; sem órfão estreito)
 * - settings-card--compact: seções com poucos campos (não esticar altura artificial)
 * - settings-card--flush: listas de SettingsRow sem padding extra
 * - Evitar min-height alto no painel quando a seção é esparsa
 *
 * Status:
 * - Ativo → SettingsStatusBadge (Badge variant success)
 * - Em breve → SettingsStatusBadge (Badge variant neutral, borda tracejada + cadeado)
 * - SettingsInfoCard já aceita ok | pending | neutral (ícone e borda reagem ao status)
 * - Opções futuras em listas: settings-locked-option (checkbox desabilitado + badge)
 *
 * Segurança:
 * - settings-summary-bar com contagem "N de M recursos ativos"
 * - Links de ação padronizados ("Abrir" + seta) no rodapé do card
 *
 * Organização:
 * - settings-cards-grid--2col (grade 2×2 consistente)
 * - settings-info-card--featured usa acento da marca (não verde de sucesso)
 * - settings-callout com superfície accent (alinhado ao tema)
 *
 * Lixeira e retenção:
 * - Formulário estreito centralizado (settings-retention-card)
 * - Preview dinâmico + dias desabilitados no modo manual
 * - Salvar só habilitado com alteração pendente
 *
 * Sistema:
 * - Lista "Sobre o sistema" com grupos (identidade / infraestrutura)
 * - Ambiente e Build em "detalhes avançados" recolhíveis
 * - Cards de status em settings-cards-grid--3col
 *
 * Dependências:
 * - settings-dependent-group: borda lateral + indentação para opções filhas
 * - settings-dependent-group--inactive: quando o pai está desligado
 *
 * Upload e IA:
 * - settings-summary-bar abaixo da nota da seção (não pill solta)
 * - Grid 2 colunas equilibradas (settings-workflow-panel__grid--balanced)
 * - Nome do documento: lista compacta (settings-choice-item--compact)
 *
 * Autenticação:
 * - Resumo em uma linha + expansor "Ver detalhes técnicos"
 * - Sessões ativas: SettingsFieldGroup + settings-locked-option (Em breve)
 * - Senha: revealable no Input, checklist e indicador de força (só UI)
 *
 * Linha de configuração:
 * - SettingsRow: label + descrição à esquerda, controle à direita (estilo Vercel/Linear)
 * - Usar em telas simples (preferências, retenção, toggles)
 */
export const SETTINGS_UI_PATTERN = {
  pageEyebrow: 'Configurações',
  contentPanelMinHeight: 'auto',
  cardGap: '1rem',
  sectionBodyGap: '1.25rem',
  rowMinHeight: '3.25rem',
} as const;
