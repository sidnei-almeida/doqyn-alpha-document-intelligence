import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ExplorerFolderCard } from './ExplorerFolderCard';
import { ExplorerHomeSection } from './ExplorerHomeSection';
import type { LibraryFolder, LibraryViewMode } from '../types/library';

type ExplorerFolderGridProps = {
  folders: LibraryFolder[];
  viewMode: LibraryViewMode;
  onOpenFolder: (folder: LibraryFolder) => void;
  onFolderContextMenu: (folder: LibraryFolder, x: number, y: number) => void;
  onFolderInfo?: (folder: LibraryFolder) => void;
};

/** Pastas inteligentes na home — grid compacto estilo file explorer. */
export function ExplorerFolderGrid({
  folders,
  viewMode,
  onOpenFolder,
  onFolderContextMenu,
  onFolderInfo,
}: ExplorerFolderGridProps) {
  if (folders.length === 0) {
    return (
      <ExplorerHomeSection title="Pastas inteligentes" data-testid="explorer-folder-grid-empty">
        <div className="explorer-folder-grid-empty rounded-xl px-6 py-10 text-center">
          <p className="text-[14px] font-medium text-doqyn-text">
            Nenhuma pasta inteligente configurada
          </p>
          <p className="mt-2 text-[12px] text-doqyn-muted">
            Crie categorias em{' '}
            <Link to="/rules" className="text-doqyn-accent-active hover:underline">
              Regras
            </Link>{' '}
            para organizar documentos por classificação da IA.
          </p>
        </div>
      </ExplorerHomeSection>
    );
  }

  return (
    <ExplorerHomeSection title="Pastas inteligentes" data-testid="explorer-folder-grid">
      <div
        // Registro, não mosaico: as pastas empilham como linhas de índice. Em
        // tela larga viram duas colunas para não desperdiçar a metade direita,
        // mas cada coluna continua sendo uma pilha de linhas — quatro colunas
        // transformavam o fio de separação em célula de tabela quebrada.
        className={cn(
          'grid gap-x-10',
          viewMode === 'grid' ? 'grid-cols-1 2xl:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {folders.map((folder) => (
          <ExplorerFolderCard
            key={folder.id}
            folder={folder}
            onOpen={onOpenFolder}
            onContextMenu={onFolderContextMenu}
            onShowInfo={onFolderInfo}
          />
        ))}
      </div>
    </ExplorerHomeSection>
  );
}
