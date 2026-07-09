import { WorkspaceLayout } from '@/app/layout/WorkspaceLayout';

/**
 * Layout autenticado do app. A estrutura visual (sidebar, topbar, upload global)
 * vive em WorkspaceLayout; este alias preserva o ponto de entrada das rotas.
 */
export function AppLayout() {
  return <WorkspaceLayout />;
}
