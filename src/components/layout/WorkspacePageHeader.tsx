import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { WorkspacePageActions } from './WorkspacePageActions';

export type WorkspacePageHeaderProps = {
  /** Breadcrumb ou navegação contextual acima do título. */
  breadcrumb?: ReactNode;
  /** Rótulo curto acima do título (ex.: Governança). */
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  /** Metadado discreto abaixo do subtítulo (ex.: contagem de arquivos). */
  meta?: ReactNode;
  /** Elemento ao lado do título (ex.: chevron decorativo). */
  titleAccessory?: ReactNode;
  /** Ações alinhadas à direita — info sempre por último no grupo. */
  actions?: ReactNode;
  /** Conteúdo abaixo do título (chips, filtros, toolbar secundária). */
  toolbar?: ReactNode;
  className?: string;
  'data-testid'?: string;
};

/**
 * Header interno padronizado do workspace — título à esquerda, ações à direita.
 * Usado na Biblioteca, PageShell e demais telas principais.
 */
export function WorkspacePageHeader({
  breadcrumb,
  eyebrow,
  title,
  subtitle,
  meta,
  titleAccessory,
  actions,
  toolbar,
  className,
  'data-testid': testId = 'workspace-page-header',
}: WorkspacePageHeaderProps) {
  return (
    <header className={cn('workspace-page-header', className)} data-testid={testId}>
      {breadcrumb && <div className="workspace-page-breadcrumb mb-2">{breadcrumb}</div>}

      {eyebrow && <p className="workspace-page-eyebrow mb-1">{eyebrow}</p>}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h1 className="workspace-page-title">{title}</h1>
            {titleAccessory}
          </div>
          {subtitle && <p className="workspace-page-subtitle">{subtitle}</p>}
          {meta && <div className="workspace-page-meta">{meta}</div>}
        </div>

        {actions && <WorkspacePageActions>{actions}</WorkspacePageActions>}
      </div>

      {toolbar && <div className="workspace-page-toolbar mt-4">{toolbar}</div>}
    </header>
  );
}
