export const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'DOQYN';
/**
 * O estado de um documento: a chave é o dado, o rótulo é o catálogo.
 *
 * Mesma separação de `src/lib/theme.ts`. O que fica aqui é o que não se traduz — o
 * identificador do estado e a cor semântica que ele resolve.
 */
export const DOCUMENT_STATUSES = {
  active: { labelKey: 'common:documentStatus.active', variant: 'success' as const },
  processed: { labelKey: 'common:documentStatus.processed', variant: 'success' as const },
  analyzing: { labelKey: 'common:documentStatus.analyzing', variant: 'info' as const },
  updated: { labelKey: 'common:documentStatus.updated', variant: 'success' as const },
  pending_review: { labelKey: 'common:documentStatus.pendingReview', variant: 'warning' as const },
  needs_review: { labelKey: 'common:documentStatus.needsReview', variant: 'danger' as const },
  available: { labelKey: 'common:documentStatus.available', variant: 'success' as const },
  pending_analysis: {
    labelKey: 'common:documentStatus.pendingAnalysis',
    variant: 'warning' as const,
  },
  update_processed: {
    labelKey: 'common:documentStatus.updateProcessed',
    variant: 'success' as const,
  },
  review_required: {
    labelKey: 'common:documentStatus.reviewRequired',
    variant: 'danger' as const,
  },
};

export const PROCESSING_STEPS = [
  {
    id: 1,
    labelKey: 'common:processingStep.uploadLabel',
    descriptionKey: 'common:processingStep.uploadDescription',
  },
  {
    id: 2,
    labelKey: 'common:processingStep.analysisLabel',
    descriptionKey: 'common:processingStep.analysisDescription',
  },
  {
    id: 3,
    labelKey: 'common:processingStep.metadataLabel',
    descriptionKey: 'common:processingStep.metadataDescription',
  },
  {
    id: 4,
    labelKey: 'common:processingStep.readyLabel',
    descriptionKey: 'common:processingStep.readyDescription',
  },
];

export const NAV_ITEMS_PRIMARY = [
  { labelKey: 'common:nav.biblioteca', path: '/biblioteca', icon: 'folder' },
] as const;

/** Views da Biblioteca — recortes sobre a listagem real (listDocuments). */
export const NAV_ITEMS_LIBRARY_VIEWS = [
  {
    labelKey: 'common:nav.compartilhados',
    path: '/biblioteca/compartilhados',
    icon: 'folder_shared',
  },
  { labelKey: 'common:nav.assinaturas', path: '/biblioteca/assinaturas', icon: 'draw' },
  { labelKey: 'common:nav.pedidos', path: '/pedidos', icon: 'assignment' },
  { labelKey: 'common:nav.contatos', path: '/contatos', icon: 'group' },
  { labelKey: 'common:nav.recentes', path: '/biblioteca/recentes', icon: 'history' },
  { labelKey: 'common:nav.favoritos', path: '/biblioteca/favoritos', icon: 'star' },
  { labelKey: 'common:nav.lixeira', path: '/biblioteca/lixeira', icon: 'delete' },
] as const;

export const NAV_ITEMS_ADMIN = [
  { labelKey: 'common:nav.dashboard', path: '/dashboard', icon: 'dashboard' },
  { labelKey: 'common:nav.rules', path: '/rules', icon: 'account_tree', governanceOnly: true },
  // Aberta para dono também: cada um enxerga a fatia dele, e é o servidor que decide o recorte.
  { labelKey: 'common:nav.matriz', path: '/matriz', icon: 'grid_on' },
  { labelKey: 'common:nav.users', path: '/users', icon: 'group', managerOnly: true },
  { labelKey: 'common:nav.audit', path: '/audit', icon: 'shield' },
  { labelKey: 'common:nav.tracking', path: '/tracking', icon: 'monitoring', trackingOnly: true },
  {
    labelKey: 'common:nav.desativados',
    path: '/biblioteca/desativados',
    icon: 'block',
    adminOnly: true,
  },
  { labelKey: 'common:nav.settings', path: '/settings', icon: 'settings' },
] as const;

/** @deprecated Use NAV_ITEMS_PRIMARY and NAV_ITEMS_ADMIN */
export const NAV_ITEMS = [...NAV_ITEMS_PRIMARY, ...NAV_ITEMS_ADMIN] as const;
