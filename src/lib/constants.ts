export const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'DOQYN';
export const AUTH_PROVIDER = import.meta.env.VITE_AUTH_PROVIDER ?? '';
export const AUTH_MODE = import.meta.env.VITE_AUTH_MODE ?? 'temporary';

export const AUTH_PROVIDER_LABELS: Record<string, string> = {
  doqyn_auth: 'doqyn-auth-service',
  mock: 'Desenvolvimento (mock)',
  temporary: 'Acesso por credenciais (legado)',
};

export const AUTH_MODE_LABELS: Record<string, string> = {
  temporary: 'Acesso por credenciais',
  mock: 'Demonstração',
};

export const ACCESS_GROUPS = ['Financeiro', 'Frete', 'Jurídico', 'RH'] as const;

export const DOCUMENT_TYPES = [
  'Contrato',
  'Nota Fiscal',
  'Relatório',
  'Política Interna',
  'Comprovante',
  'Outro',
] as const;

export const DOCUMENT_STATUSES = {
  active: { label: 'Ativo', variant: 'success' as const },
  processed: { label: 'Processado', variant: 'success' as const },
  analyzing: { label: 'Em análise', variant: 'info' as const },
  updated: { label: 'Atualizado', variant: 'success' as const },
  pending_review: { label: 'Aguardando revisão', variant: 'warning' as const },
  needs_review: { label: 'Requer revisão', variant: 'danger' as const },
  available: { label: 'Disponível', variant: 'success' as const },
  pending_analysis: { label: 'Aguardando análise', variant: 'warning' as const },
  update_processed: { label: 'Atualização processada', variant: 'success' as const },
  review_required: { label: 'Revisão necessária', variant: 'danger' as const },
};

export const PROCESSING_STEPS = [
  { id: 1, label: 'Upload recebido', description: 'Documento registrado com segurança' },
  { id: 2, label: 'Análise do documento', description: 'Verificação e validação inicial' },
  { id: 3, label: 'Classificação e metadados', description: 'Extração de informações relevantes' },
  { id: 4, label: 'Disponível com rastreabilidade', description: 'Documento pronto para consulta' },
];

/** `labelKey` references a key in the `nav` i18next namespace (see src/i18n/locales/<locale>/nav.json). */
export const NAV_ITEMS_PRIMARY = [
  { labelKey: 'library', path: '/biblioteca', icon: 'folder' },
] as const;

/** Views da Biblioteca — recortes sobre a listagem real (listDocuments). */
export const NAV_ITEMS_LIBRARY_VIEWS = [
  { labelKey: 'sharedWithMe', path: '/biblioteca/compartilhados', icon: 'folder_shared' },
  { labelKey: 'toSign', path: '/biblioteca/assinaturas', icon: 'draw' },
  { labelKey: 'recent', path: '/biblioteca/recentes', icon: 'history' },
  { labelKey: 'favorites', path: '/biblioteca/favoritos', icon: 'star' },
  { labelKey: 'trash', path: '/biblioteca/lixeira', icon: 'delete' },
] as const;

export const NAV_ITEMS_ADMIN = [
  { labelKey: 'overview', path: '/dashboard', icon: 'dashboard' },
  { labelKey: 'rules', path: '/rules', icon: 'account_tree', governanceOnly: true },
  { labelKey: 'users', path: '/users', icon: 'group', managerOnly: true },
  { labelKey: 'audit', path: '/audit', icon: 'shield' },
  { labelKey: 'tracking', path: '/tracking', icon: 'monitoring', trackingOnly: true },
  {
    labelKey: 'deactivated',
    path: '/biblioteca/desativados',
    icon: 'block',
    adminOnly: true,
  },
  { labelKey: 'settings', path: '/settings', icon: 'settings' },
] as const;

/** @deprecated Use NAV_ITEMS_PRIMARY and NAV_ITEMS_ADMIN */
export const NAV_ITEMS = [...NAV_ITEMS_PRIMARY, ...NAV_ITEMS_ADMIN] as const;
