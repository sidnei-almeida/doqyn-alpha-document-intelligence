import { Outlet, useSearchParams } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { WorkspaceTopBar } from '@/components/layout/WorkspaceTopBar';
import { useDocumentCategories } from '@/features/library/hooks/useCategoryFolders';
import { resolveLibraryCategoryId } from '@/features/library/utils/resolveLibraryCategory';
import { ReviewDrawer } from '@/features/upload/review/ReviewDrawer';
import { UploadDropOverlay } from '@/features/upload/drag-drop/UploadDropOverlay';
import { UploadQueueDrawer } from '@/features/upload/UploadQueueDrawer';
import { UploadQueueProvider } from '@/features/upload/UploadQueueProvider';
import { useUploadQueueContext } from '@/features/upload/uploadQueueContext';
import { useGlobalDragDrop } from '@/features/upload/drag-drop/useGlobalDragDrop';
import { useSignatureCompletionSync } from '@/features/signature/hooks/useSignatureCompletionSync';
import { TourProvider } from '@/features/tour/TourProvider';
import { TourOverlay } from '@/features/tour/components/TourOverlay';
import { useTenantLiveSync } from '@/features/tenant/useTenantLiveSync';

/**
 * Shell autenticado do workspace — duas camadas: a casca edge-to-edge (sidebar
 * + barra de cima) e o painel de conteúdo, arredondado e recuado dentro dela.
 *
 * A estrutura é a mesma nos três temas; o que muda é a paleta de cada camada.
 * A classe `chrome-dark` fica sempre na marcação, mas só vale no tema padrão —
 * é o CSS que decide, via `data-appearance`, não o React. Assim trocar de tema
 * não remonta o shell.
 */
function WorkspaceLayoutInner() {
  const { startUploadFromFiles } = useUploadQueueContext();
  useSignatureCompletionSync();
  useTenantLiveSync();
  const [searchParams] = useSearchParams();
  const { data: categories = [] } = useDocumentCategories();

  const activeSpaceId = searchParams.get('space') ?? '';
  const resolvedSpaceId = activeSpaceId ? resolveLibraryCategoryId(activeSpaceId, categories) : '';
  const activeCategory = resolvedSpaceId
    ? categories.find((category) => category.id === resolvedSpaceId)
    : undefined;

  const { isDragging } = useGlobalDragDrop((files) => {
    startUploadFromFiles(
      files,
      activeCategory
        ? { categoryId: activeCategory.id, categoryName: activeCategory.name }
        : undefined,
    );
  });

  return (
    <div className="app-chrome chrome-dark h-dvh w-full overflow-hidden">
      <div className="app-shell flex h-full w-full overflow-hidden">
        <Sidebar />
        <div className="workspace-frame flex min-h-0 min-w-0 flex-1 flex-col">
          <WorkspaceTopBar />
          <main className="main-content workspace-canvas flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="workspace-canvas-inner scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="page-outlet flex min-h-full flex-1 flex-col py-6 sm:py-7">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>

      <UploadDropOverlay isDragging={isDragging} />
      <UploadQueueDrawer />
      <ReviewDrawer />
      <TourOverlay />
    </div>
  );
}

export function WorkspaceLayout() {
  return (
    <UploadQueueProvider>
      {/* O tour envolve o shell inteiro: ele aponta para a sidebar, para a
          barra de cima e para o conteúdo da rota, e navega entre rotas no meio
          do caminho — precisa sobreviver à troca de página. */}
      <TourProvider>
        <WorkspaceLayoutInner />
      </TourProvider>
    </UploadQueueProvider>
  );
}
