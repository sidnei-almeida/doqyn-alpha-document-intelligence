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

/**
 * Shell autenticado do workspace — estilo Google Drive:
 * chrome edge-to-edge (sem radius externo) + painel interno arredondado.
 */
function WorkspaceLayoutInner() {
  const { startUploadFromFiles } = useUploadQueueContext();
  const [searchParams] = useSearchParams();
  const { data: categories = [] } = useDocumentCategories();

  const activeSpaceId = searchParams.get('space') ?? '';
  const resolvedSpaceId = activeSpaceId
    ? resolveLibraryCategoryId(activeSpaceId, categories)
    : '';
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
    <div className="app-chrome h-dvh w-full overflow-hidden">
      <div className="app-shell flex h-full w-full overflow-hidden">
        <Sidebar />
        <div className="workspace-frame flex min-h-0 min-w-0 flex-1 flex-col">
          <WorkspaceTopBar />
          <main className="main-content workspace-canvas flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="workspace-canvas-inner flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
              <div className="page-outlet flex min-h-full flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>

      <UploadDropOverlay isDragging={isDragging} />
      <UploadQueueDrawer />
      <ReviewDrawer />
    </div>
  );
}

export function WorkspaceLayout() {
  return (
    <UploadQueueProvider>
      <WorkspaceLayoutInner />
    </UploadQueueProvider>
  );
}
