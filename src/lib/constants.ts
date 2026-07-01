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

export const NAV_ITEMS_PRIMARY = [
  { label: 'Visão Geral', path: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Envio de Documentos', path: '/upload', icon: 'Upload' },
] as const;

export const NAV_ITEMS_ADMIN = [
  { label: 'Regras', path: '/rules', icon: 'Scale' },
  { label: 'Usuários', path: '/users', icon: 'Users', managerOnly: true },
  { label: 'Auditoria', path: '/audit', icon: 'Shield' },
  { label: 'Configurações', path: '/settings', icon: 'Settings' },
] as const;

/** @deprecated Use NAV_ITEMS_PRIMARY and NAV_ITEMS_ADMIN */
export const NAV_ITEMS = [...NAV_ITEMS_PRIMARY, ...NAV_ITEMS_ADMIN] as const;
