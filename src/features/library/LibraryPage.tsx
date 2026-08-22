import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/auth/useAuth';
import { DocumentViewerModal } from '@/features/documents/viewer';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import { ALLOWED_FILE_EXTENSIONS } from '@/features/document-send/uploadConstants';
import { useUploadQueueContext } from '@/features/upload/uploadQueueContext';
import type { UploadContext } from '@/features/upload/types';
import type { DocumentListItem } from '@/types/document-library';
import { downloadDocument, triggerBlobDownload } from './api/libraryApi';
import { ExplorerShell } from './components/ExplorerShell';
import { ExplorerContextMenu, type ExplorerContextMenuState } from './components/ExplorerContextMenu';
import { ExplorerRootHome } from './components/ExplorerRootHome';
import { ExplorerPageHeader } from './components/ExplorerPageHeader';
import { LibraryBreadcrumbs } from './components/LibraryBreadcrumbs';
import { buildLibraryBreadcrumbSegments } from './utils/libraryItemActions';
import { FileTable } from './components/FileTable';
import { ExplorerFolderFiles, FileTableSkeleton } from './components/ExplorerFolderFiles';
import { FileGridView } from './components/FileGridView';
import { OptionalDetailsDrawer } from './components/OptionalDetailsDrawer';
import { ContextInfoButton } from './components/ContextInfoButton';
import { LibraryToolbar } from './components/LibraryToolbar';
import type { LibraryOverview } from './components/detailsPanelTypes';
import { EmptyFolderState } from './components/EmptyFolderState';
import { LibraryContentDropZone } from './components/LibraryContentDropZone';
import { ExplorerActionsProvider } from './context/ExplorerActionsContext';
import { MarqueeSelectionProvider } from './context/MarqueeSelectionProvider';
import { useCategoryFolders } from './hooks/useCategoryFolders';
import { useLibraryExplorerMode } from './hooks/useLibraryExplorerMode';
import { useExplorerSelection } from './hooks/useExplorerSelection';
import { useExplorerSelectionShortcuts } from './hooks/useExplorerSelectionShortcuts';
import { useLibraryView } from './hooks/useLibraryView';
import type { LibraryFolder, LibrarySelection } from './types/library';
import { SearchScopeHint } from './components/SearchScopeHint';
import { hasActiveLibraryFilters } from './utils/libraryFilterUtils';
import {
  pruneUnsupportedLibraryFilters,
  resolveCollectionFilterCapabilities,
} from './utils/libraryCollectionFilterCapabilities';
import { invalidateLibraryQueries } from './utils/libraryQueryInvalidation';
import { findLibraryCategory } from './utils/resolveLibraryCategory';
import {
  pickRecentDocuments,
  pickUncategorizedDocuments,
} from './utils/libraryHomeSections';
import { useConfirm } from '@/components/confirm/useConfirm';
import {
  buildMoveToTrashConfirm,
} from '@/components/confirm/confirmMessages';

import { useTrashMutations } from './hooks/useTrashMutations';
import { useDeactivatedMutations } from './hooks/useDeactivatedMutations';
import { useMoveDocumentMutations } from './hooks/useMoveDocumentMutations';
import { MoveDocumentModal } from './components/MoveDocumentModal';
import { ShareDocumentModal } from '@/features/sharing/components/ShareDocumentModal';
import { DocumentMetadataDrawer } from './components/DocumentMetadataDrawer';
import { RequestSignatureModal } from '@/features/signature/RequestSignatureModal';
import { SignaturesAssignedPanel } from '@/features/signature/components/SignaturesAssignedPanel';
import { DocumentSignaturesDrawer } from '@/features/signature/DocumentSignaturesDrawer';
import { downloadSignatureRequestSignedPdf } from '@/features/signature/api/signatureApi';
import { signedPdfDownloadName } from '@/features/signature/utils/signatureSummaryDisplay';
import { UpdateDocumentVersionDrawer } from '@/features/document-update-version';
import { TransferOwnershipModal } from '@/features/documents/components/TransferOwnershipModal';

function notifyComingSoon(label: string) {
  toast.info(`${label} estará disponível em uma próxima versão.`);
}

/**
 * Biblioteca — File Explorer com pastas inteligentes (categorias de governança).
 * Raiz: pastas em destaque. Dentro da pasta: arquivos como protagonistas.
 */
export function LibraryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { tenant, user, hasAnyRole } = useAuth();
  const { state, update, clearFilters, collection, categories, documents, isLoading, isError, toggleStar, isStarred } =
    useLibraryView();
  const filterCapabilities = useMemo(
    () => resolveCollectionFilterCapabilities(collection.id),
    [collection.id],
  );

  useEffect(() => {
    const patch = pruneUnsupportedLibraryFilters(state, collection.id);
    if (patch) update(patch);
  }, [
    collection.id,
    state.status,
    state.type,
    state.period,
    state.owner,
    state.sort,
    state.direction,
    update,
  ]);
  const explorer = useLibraryExplorerMode(state, collection);
  const { folders, isLoading: foldersLoading } = useCategoryFolders(documents);
  const documentOrder = useMemo(() => documents.map((doc) => doc.documentId), [documents]);
  const explorerSelection = useExplorerSelection(documentOrder);
  const confirm = useConfirm();
  const { moveToTrash, restore } = useTrashMutations();
  const { reactivate } = useDeactivatedMutations();
  const { moveDocuments } = useMoveDocumentMutations();
  const isTrashView = collection.id === 'lixeira';
  const isDeactivatedView = collection.id === 'desativados';
  const isLifecycleArchiveView = isTrashView || isDeactivatedView;
  const isSignaturesView = collection.id === 'para-assinar';
  const canManageDeactivated = hasAnyRole(['company_admin', 'individual_admin']);

  useEffect(() => {
    if (isDeactivatedView && !canManageDeactivated) {
      navigate('/biblioteca', { replace: true });
    }
  }, [isDeactivatedView, canManageDeactivated, navigate]);
  const {
    selectedCount,
    selectedFileIds,
    selectedFolderIds,
    clearSelection,
    applyMarqueeSelection,
    restoreSelection,
    captureSelectionSnapshot,
  } = explorerSelection;
  const [marqueeDragging, setMarqueeDragging] = useState(false);
  const { startUploadFromFiles } = useUploadQueueContext();

  const [viewer, setViewer] = useState<{
    documentId: string;
    versionId?: string;
    mode: 'details' | 'preview';
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<ExplorerContextMenuState>(null);

  useExplorerSelectionShortcuts({
    onClearSelection: clearSelection,
    blockClear: Boolean(contextMenu) || marqueeDragging,
  });
  const [infoOpen, setInfoOpen] = useState(false);
  const [detailsDrawer, setDetailsDrawer] = useState<LibrarySelection>(null);
  const [moveModalDocs, setMoveModalDocs] = useState<DocumentListItem[] | null>(null);
  const [shareModalDoc, setShareModalDoc] = useState<DocumentListItem | null>(null);
  const [metadataDoc, setMetadataDoc] = useState<DocumentListItem | null>(null);
  const [transferModalDoc, setTransferModalDoc] = useState<DocumentListItem | null>(null);
  const [signatureModalDoc, setSignatureModalDoc] = useState<DocumentListItem | null>(null);
  const [signaturesDrawerDoc, setSignaturesDrawerDoc] = useState<DocumentListItem | null>(null);
  const [updateVersionDocumentId, setUpdateVersionDocumentId] = useState<string | null>(null);
  const emptyStateFileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadContextRef = useRef<UploadContext | undefined>(undefined);

  const activeSpace = useMemo(() => {
    if (!explorer.isRootCollection || !state.space) return null;
    const category = findLibraryCategory(state.space, categories);
    if (!category) return null;
    return (
      folders.find((folder) => folder.id === category.id) ?? {
        id: category.id,
        name: category.name,
        slug: category.slug,
        documentCount: 0,
      }
    );
  }, [folders, state.space, categories, explorer.isRootCollection]);

  const uploadContext = useMemo(
    () =>
      activeSpace
        ? { categoryId: activeSpace.id, categoryName: activeSpace.name }
        : undefined,
    [activeSpace],
  );

  const uncategorizedDocuments = useMemo(
    () => (explorer.isBrowseRoot ? pickUncategorizedDocuments(documents) : []),
    [documents, explorer.isBrowseRoot],
  );

  const recentDocuments = useMemo(
    () => (explorer.isBrowseRoot ? pickRecentDocuments(documents) : []),
    [documents, explorer.isBrowseRoot],
  );

  const uncategorizedForHome = useMemo(() => {
    const recentIds = new Set(recentDocuments.map((doc) => doc.documentId));
    return uncategorizedDocuments.filter((doc) => !recentIds.has(doc.documentId)).slice(0, 6);
  }, [recentDocuments, uncategorizedDocuments]);

  const hasActiveFilters = hasActiveLibraryFilters(state);
  const trimmedQuery = state.q.trim();

  const pageTitle = trimmedQuery
    ? 'Resultados da busca'
    : explorer.isInsideFolder
      ? (activeSpace?.name ?? 'Pasta')
      : explorer.isBrowseRoot
        ? 'Biblioteca'
        : (collection.label ?? 'Biblioteca');

  const pageDescription = trimmedQuery
    ? `${documents.length} ${documents.length === 1 ? 'documento encontrado' : 'documentos encontrados'} para “${trimmedQuery}”`
    : explorer.isInsideFolder
      ? 'Documentos classificados nesta categoria pela IA.'
      : explorer.isBrowseRoot
        ? 'Documentos e categorias deste ambiente'
        : collection.description;

  const libraryOverview = useMemo<LibraryOverview>(
    () => ({
      title: pageTitle,
      description: pageDescription,
      folderCount: folders.length,
      fileCount: documents.length,
      categoryName: activeSpace?.name,
    }),
    [pageTitle, pageDescription, folders.length, documents.length, activeSpace?.name],
  );

  const openFileDetails = useCallback((doc: DocumentListItem) => {
    setDetailsDrawer({ kind: 'file', document: doc });
  }, []);

  const openFolderDetails = useCallback((folder: LibraryFolder) => {
    setDetailsDrawer({ kind: 'folder', folder });
  }, []);

  const closeDetailsDrawer = useCallback(() => {
    setDetailsDrawer(null);
  }, []);

  const breadcrumbSegments = useMemo(() => {
    const built = buildLibraryBreadcrumbSegments({
      collectionLabel: collection.label,
      spaceName: activeSpace?.name,
      isRootCollection: explorer.isRootCollection,
    });
    return built.map((segment) => ({
      ...segment,
      onClick:
        segment.key === 'space'
          ? undefined
          : segment.key === 'collection'
            ? () => {
                clearSelection();
                navigate(`/biblioteca/${collection.slug}`);
              }
            : undefined,
    }));
  }, [
    activeSpace?.name,
    clearSelection,
    collection.label,
    collection.slug,
    explorer.isRootCollection,
    navigate,
  ]);

  const openSpace = useCallback(
    (folder: LibraryFolder) => {
      clearSelection();
      update({
        space: folder.id,
        q: '',
        status: '',
        type: '',
        period: '',
        owner: '',
        scope: '',
      });
    },
    [clearSelection, update],
  );

  const goToRoot = useCallback(() => {
    clearSelection();
    if (explorer.isRootCollection) {
      update({ space: '' });
    } else {
      navigate('/biblioteca');
    }
  }, [clearSelection, explorer.isRootCollection, navigate, update]);

  const refreshLibrary = useCallback(() => {
    void invalidateLibraryQueries(queryClient, tenant?.tenantId ?? user?.companyId);
  }, [queryClient, tenant?.tenantId, user?.companyId]);

  const triggerUploadPicker = useCallback((context?: UploadContext) => {
    pendingUploadContextRef.current = context ?? uploadContext;
    emptyStateFileInputRef.current?.click();
  }, [uploadContext]);

  const startUploadInFolder = useCallback(
    (folder: LibraryFolder) => {
      triggerUploadPicker({ categoryId: folder.id, categoryName: folder.name });
    },
    [triggerUploadPicker],
  );

  const handlePreview = (doc: DocumentListItem, versionId?: string) => {
    setViewer({ documentId: doc.documentId, versionId, mode: 'preview' });
  };

  const closeUpdateVersionDrawer = useCallback(() => {
    setUpdateVersionDocumentId(null);
    if (searchParams.get('updateVersion')) {
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          next.delete('updateVersion');
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  const openUpdateVersionDrawer = useCallback((documentId: string) => {
    setUpdateVersionDocumentId(documentId);
  }, []);

  const handleUpdateDocument = useCallback(
    (doc: DocumentListItem) => {
      openUpdateVersionDrawer(doc.documentId);
    },
    [openUpdateVersionDrawer],
  );

  // Abrir um documento específico por link — é como o Tracking devolve o usuário ao arquivo que
  // ele estava investigando, sem obrigá-lo a procurar o nome na Biblioteca.
  useEffect(() => {
    const previewId = searchParams.get('preview')?.trim();
    if (!previewId) return;

    setViewer({ documentId: previewId, mode: 'preview' });
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.delete('preview');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const fromUrl = searchParams.get('updateVersion')?.trim();
    if (fromUrl) {
      setUpdateVersionDocumentId(fromUrl);
    }
  }, [searchParams]);

  const handleOpen = (doc: DocumentListItem) => {
    setViewer({
      documentId: doc.documentId,
      mode: doc.permissions?.canPreview === false ? 'details' : 'preview',
    });
  };

  const handleDownload = useCallback(async (doc: DocumentListItem) => {
    if (!doc.permissions?.canDownload || !doc.latestVersionId) return;
    try {
      const { blob, fileName } = await downloadDocument(doc.documentId, doc.latestVersionId);
      triggerBlobDownload(blob, fileName || doc.currentFileName);
    } catch (error) {
      showApiErrorToast(error, 'Não foi possível baixar o documento.');
    }
  }, []);

  const handleBulkDownload = useCallback(
    async (docs: DocumentListItem[]) => {
      const downloadable = docs.filter(
        (doc) => doc.permissions?.canDownload && doc.latestVersionId,
      );
      for (const doc of downloadable) {
        await handleDownload(doc);
      }
    },
    [handleDownload],
  );

  const handleMoveToTrash = useCallback(
    async (documentIds: string[]) => {
      if (!documentIds.length) return;
      const accepted = await confirm(buildMoveToTrashConfirm(documentIds.length));
      if (!accepted) return;
      moveToTrash.mutate({ documentIds });
      clearSelection();
    },
    [clearSelection, confirm, moveToTrash],
  );

  const handleRestoreFromTrash = useCallback(
    async (documentIds: string[]) => {
      if (!documentIds.length) return;
      restore.mutate({ documentIds });
      clearSelection();
    },
    [clearSelection, restore],
  );

  const handleReactivate = useCallback(
    async (documentIds: string[]) => {
      if (!documentIds.length) return;
      reactivate.mutate({ documentIds });
      clearSelection();
    },
    [clearSelection, reactivate],
  );

  const handleTrashSingle = useCallback(
    (doc: DocumentListItem) => {
      void handleMoveToTrash([doc.documentId]);
    },
    [handleMoveToTrash],
  );

  const openMoveModal = useCallback((docs: DocumentListItem[]) => {
    if (!docs.length || isLifecycleArchiveView) return;
    setMoveModalDocs(docs);
  }, [isLifecycleArchiveView]);

  const handleMoveSingle = useCallback(
    (doc: DocumentListItem) => {
      openMoveModal([doc]);
    },
    [openMoveModal],
  );

  const handleBulkMove = useCallback(() => {
    const selectedDocs = documents.filter((doc) => selectedFileIds.has(doc.documentId));
    if (!selectedDocs.length || selectedFolderIds.size > 0) return;
    openMoveModal(selectedDocs);
  }, [documents, openMoveModal, selectedFileIds, selectedFolderIds.size]);

  const handleConfirmMove = useCallback(
    (targetClassId: string) => {
      if (!moveModalDocs?.length) return;
      moveDocuments.mutate(
        {
          documentIds: moveModalDocs.map((doc) => doc.documentId),
          targetClassId,
          reason: 'Movido manualmente pelo usuário',
        },
        {
          onSuccess: () => {
            setMoveModalDocs(null);
            clearSelection();
          },
        },
      );
    },
    [clearSelection, moveDocuments, moveModalDocs],
  );

  const handleShareSingle = useCallback(
    (doc: DocumentListItem) => {
      if (isLifecycleArchiveView || selectedCount > 1) return;
      setShareModalDoc(doc);
    },
    [isLifecycleArchiveView, selectedCount],
  );

  const handleEditMetadata = useCallback((doc: DocumentListItem) => {
    setMetadataDoc(doc);
  }, []);

  const handleRequestSignature = useCallback(
    (doc: DocumentListItem) => {
      if (isLifecycleArchiveView || selectedCount > 1) return;
      setSignatureModalDoc(doc);
    },
    [isLifecycleArchiveView, selectedCount],
  );

  const handleViewSignatures = useCallback((doc: DocumentListItem) => {
    setSignaturesDrawerDoc(doc);
  }, []);

  const handleDownloadSignedPdf = useCallback(async (doc: DocumentListItem) => {
    const requestId = doc.signatureSummary?.latestRequestId;
    if (!requestId || !doc.signatureSummary?.hasSignedPdf) {
      toast.error('PDF assinado indisponível para este documento.');
      return;
    }
    try {
      const blob = await downloadSignatureRequestSignedPdf(requestId);
      triggerBlobDownload(
        blob,
        signedPdfDownloadName(
          doc.currentFileName ?? doc.displayName,
          doc.signatureSummary.verificationCode,
        ),
      );
    } catch (error) {
      showApiErrorToast(error, 'Falha ao baixar PDF assinado.');
    }
  }, []);

  const handleTracking = (doc: DocumentListItem) => {
    navigate(`/tracking?documentId=${encodeURIComponent(doc.documentId)}`);
  };

  const handleDropFiles = (files: File[]) => {
    if (files.length > 0) startUploadFromFiles(files, uploadContext);
  };

  const handleEmptyStateFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    const context = pendingUploadContextRef.current ?? uploadContext;
    pendingUploadContextRef.current = undefined;
    if (files.length > 0) {
      startUploadFromFiles(files, context);
    }
    if (emptyStateFileInputRef.current) emptyStateFileInputRef.current.value = '';
  };

  const handleBackgroundContextMenu = (event: React.MouseEvent) => {
    if (event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-explorer-item]')) return;
    event.preventDefault();
    setContextMenu({
      kind: 'empty',
      x: event.clientX,
      y: event.clientY,
      scope: explorer.isInsideFolder ? 'folder' : 'root',
    });
  };

  const showFilterMenus =
    !isSignaturesView &&
    (explorer.isInsideFolder ||
      explorer.isSearchOrFilterAtRoot ||
      explorer.isVirtualCollection);

  const shellVariant = explorer.isBrowseRoot
    ? 'explorer-root'
    : explorer.isInsideFolder
      ? 'explorer-folder'
      : 'default';

  const renderFileList = (fileDocs: DocumentListItem[], title?: string) => {
    if (fileDocs.length === 0) return null;
    if (explorer.isInsideFolder) {
      return <ExplorerFolderFiles documents={fileDocs} viewMode={state.view} />;
    }
    return state.view === 'grid' ? (
      <FileGridView documents={fileDocs} />
    ) : (
      <FileTable documents={fileDocs} title={title} />
    );
  };

  let mainContent: React.ReactNode;

  if (isSignaturesView) {
    mainContent = <SignaturesAssignedPanel search={trimmedQuery} />;
  } else if (isLoading || (explorer.isBrowseRoot && foldersLoading)) {
    mainContent = explorer.isBrowseRoot ? (
      <div
        className="explorer-root-home flex flex-col gap-8 pb-6"
        data-testid="explorer-root-loading"
        aria-busy="true"
        aria-label="Carregando biblioteca"
      >
        <div className="space-y-3">
          <div className="skeleton-line h-4 w-16 rounded bg-doqyn-card" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton-line h-[52px] rounded-xl bg-doqyn-card" />
            ))}
          </div>
        </div>
      </div>
    ) : (
      <FileTableSkeleton />
    );
  } else if (explorer.isBrowseRoot) {
    mainContent = (
      <ExplorerRootHome
        folders={folders}
        recentDocuments={recentDocuments}
        uncategorizedDocuments={uncategorizedForHome}
        totalDocumentCount={documents.length}
        viewMode={state.view}
        onOpenFolder={openSpace}
        onFolderContextMenu={(folder, x, y) =>
          setContextMenu({ kind: 'folder', folder, x, y })
        }
        onFolderInfo={openFolderDetails}
        onUploadClick={() => triggerUploadPicker()}
      />
    );
  } else if (explorer.isInsideFolder && documents.length === 0 && !hasActiveFilters) {
    mainContent = (
      <EmptyFolderState
        hasActiveFilters={false}
        title="Esta pasta ainda está vazia"
        description="Envie um documento para o DOQYN analisar e classificar nesta categoria."
        showUploadActions
        uploadButtonLabel="Enviar documento"
        onClearFilters={clearFilters}
        onUploadClick={triggerUploadPicker}
      />
    );
  } else if (
    (explorer.isInsideFolder || explorer.isSearchOrFilterAtRoot || explorer.isVirtualCollection) &&
    documents.length === 0
  ) {
    mainContent = (
      <EmptyFolderState
        hasActiveFilters={hasActiveFilters}
        title={
          hasActiveFilters
            ? trimmedQuery
              ? 'Nenhum documento encontrado'
              : 'Nenhum documento para os filtros atuais'
            : collection.emptyTitle
        }
        description={
          hasActiveFilters
            ? 'Tente ajustar os filtros ou buscar outro termo.'
            : collection.emptyDescription
        }
        showUploadActions={explorer.isInsideFolder}
        uploadButtonLabel="Enviar documento"
        onClearFilters={clearFilters}
        onUploadClick={triggerUploadPicker}
      />
    );
  } else {
    mainContent = renderFileList(
      documents,
      explorer.isInsideFolder ? `Arquivos em ${activeSpace?.name ?? 'pasta'}` : undefined,
    );
  }

  const content = (
    <LibraryContentDropZone
      onDropFiles={handleDropFiles}
      onBackgroundContextMenu={handleBackgroundContextMenu}
      onBackgroundClick={() => {
        if (!contextMenu && !marqueeDragging) clearSelection();
      }}
    >
      <MarqueeSelectionProvider
        onApplySelection={applyMarqueeSelection}
        onRestoreSelection={restoreSelection}
        captureSelectionSnapshot={captureSelectionSnapshot}
        onDragStateChange={setMarqueeDragging}
      >
        {mainContent}
      </MarqueeSelectionProvider>
    </LibraryContentDropZone>
  );

  return (
    <ExplorerActionsProvider
      selection={explorerSelection}
      visibleFileIds={documentOrder}
      isStarred={isStarred}
      onToggleStar={toggleStar}
      onOpenContextMenu={setContextMenu}
      onOpen={handleOpen}
      onPreview={handlePreview}
      onDownload={(doc) => void handleDownload(doc)}
      onDetails={openFileDetails}
      onTracking={handleTracking}
      onRename={() => notifyComingSoon('Renomear')}
      onMove={isLifecycleArchiveView ? undefined : handleMoveSingle}
      onShare={isLifecycleArchiveView ? undefined : handleShareSingle}
      onRequestSignature={isLifecycleArchiveView ? undefined : handleRequestSignature}
      onViewSignatures={isLifecycleArchiveView ? undefined : handleViewSignatures}
      onTrash={isLifecycleArchiveView ? undefined : handleTrashSingle}
    >
    <DndContext>
      <input
        ref={emptyStateFileInputRef}
        type="file"
        accept={ALLOWED_FILE_EXTENSIONS.join(',')}
        multiple
        className="hidden"
        onChange={(event) => handleEmptyStateFiles(event.target.files)}
        aria-hidden
        tabIndex={-1}
      />

      <ExplorerShell
        variant={shellVariant}
        header={
          <div className="space-y-0">
            <ExplorerPageHeader
              breadcrumb={
                !explorer.isBrowseRoot ? (
                  <LibraryBreadcrumbs segments={breadcrumbSegments} onNavigateRoot={goToRoot} />
                ) : undefined
              }
              title={pageTitle}
              subtitle={pageDescription}
              meta={
                <>
                  {explorer.isInsideFolder && activeSpace && (
                    <SearchScopeHint
                      state={state}
                      folderName={activeSpace.name}
                      onStateChange={update}
                    />
                  )}
                  {explorer.isInsideFolder && documents.length > 0 && !trimmedQuery ? (
                    <span>
                      {documents.length} {documents.length === 1 ? 'arquivo' : 'arquivos'}
                    </span>
                  ) : undefined}
                  {/* Sem aviso de "Atualizando…": a revalidação é silenciosa e a lista antiga
                      fica na tela até a nova chegar. */}
                </>
              }
              state={state}
              onStateChange={update}
              onClearFilters={clearFilters}
              onRefresh={refreshLibrary}
              showFilterChips={explorer.isBrowseRoot && !explorer.isSearchOrFilterAtRoot}
              showFilterMenus={showFilterMenus}
              filterCapabilities={filterCapabilities}
              showTitleChevron={explorer.isBrowseRoot && !hasActiveFilters}
              folderName={activeSpace?.name}
              infoButton={
                <ContextInfoButton
                  overview={libraryOverview}
                  folder={activeSpace}
                  open={infoOpen}
                  onOpenChange={setInfoOpen}
                />
              }
            />
            {isError && (
              <p className="mt-3 text-[12px] text-doqyn-danger">
                Não foi possível carregar os documentos agora.
              </p>
            )}
          </div>
        }
        toolbar={
          selectedCount > 0 ? (
            <LibraryToolbar
              state={state}
              selectedCount={selectedCount}
              selectedFileIds={selectedFileIds}
              selectedFolderCount={selectedFolderIds.size}
              documents={documents}
              isTrashView={isTrashView}
              isDeactivatedView={isDeactivatedView}
              onClearSelection={clearSelection}
              onBulkDownload={(docs) => void handleBulkDownload(docs)}
              onPreview={handlePreview}
              onMove={handleBulkMove}
              onTrash={(ids) => void handleMoveToTrash(ids)}
              onRestore={(ids) => void handleRestoreFromTrash(ids)}
              onReactivate={(ids) => void handleReactivate(ids)}
            />
          ) : undefined
        }
        content={content}
      />

      {detailsDrawer && (
        <OptionalDetailsDrawer
          selection={detailsDrawer}
          onClose={closeDetailsDrawer}
          onPreview={(doc) => handlePreview(doc)}
          onDownload={(doc) => void handleDownload(doc)}
          onUpdateDocument={handleUpdateDocument}
          onPreviewVersion={(doc, versionId) => handlePreview(doc, versionId)}
          onViewSignatures={handleViewSignatures}
          onDownloadSignedPdf={(doc) => void handleDownloadSignedPdf(doc)}
          onTransferOwnership={(doc) => setTransferModalDoc(doc)}
          onEditMetadata={handleEditMetadata}
        />
      )}

      <ExplorerContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(null)}
        viewMode={state.view}
        onViewModeChange={(view) => update({ view })}
        onRefresh={refreshLibrary}
        onUpload={() => triggerUploadPicker()}
        onUploadInFolder={startUploadInFolder}
        onOpenFolder={openSpace}
        onOpenFile={handleOpen}
        onPreviewFile={handlePreview}
        onDownloadFile={(doc) => void handleDownload(doc)}
        onTrackingFile={handleTracking}
        onSelectFileDetails={openFileDetails}
        onToggleFavorite={(doc) => toggleStar(doc.documentId, doc.isFavorite)}
        onUpdateDocument={handleUpdateDocument}
        onMoveFile={isLifecycleArchiveView ? undefined : handleMoveSingle}
        onShareFile={isLifecycleArchiveView ? undefined : handleShareSingle}
        onEditMetadataFile={isLifecycleArchiveView ? undefined : handleEditMetadata}
        onRequestSignatureFile={isLifecycleArchiveView ? undefined : handleRequestSignature}
        onViewSignaturesFile={isLifecycleArchiveView ? undefined : handleViewSignatures}
        onDownloadSignedPdfFile={
          isLifecycleArchiveView ? undefined : (doc) => void handleDownloadSignedPdf(doc)
        }
        onShowContextInfo={() => setInfoOpen(true)}
        onShowFolderInfo={openFolderDetails}
        isTrashView={isTrashView}
        isDeactivatedView={isDeactivatedView}
        onTrashFile={handleTrashSingle}
        onRestoreFile={(doc) => void handleRestoreFromTrash([doc.documentId])}
        onReactivateFile={(doc) => void handleReactivate([doc.documentId])}
        onComingSoon={notifyComingSoon}
      />

      <UpdateDocumentVersionDrawer
        documentId={updateVersionDocumentId}
        onClose={closeUpdateVersionDrawer}
      />

      <DocumentMetadataDrawer document={metadataDoc} onClose={() => setMetadataDoc(null)} />

      <ShareDocumentModal
        open={Boolean(shareModalDoc)}
        document={shareModalDoc}
        onClose={() => setShareModalDoc(null)}
      />

      <TransferOwnershipModal
        open={Boolean(transferModalDoc)}
        document={transferModalDoc}
        onClose={() => setTransferModalDoc(null)}
      />

      <RequestSignatureModal
        open={Boolean(signatureModalDoc)}
        document={signatureModalDoc}
        onClose={() => setSignatureModalDoc(null)}
        onCreated={() => void invalidateLibraryQueries(queryClient, tenant?.tenantId)}
      />

      <DocumentSignaturesDrawer
        document={signaturesDrawerDoc}
        onClose={() => setSignaturesDrawerDoc(null)}
      />

      <MoveDocumentModal
        open={Boolean(moveModalDocs?.length)}
        documents={moveModalDocs ?? []}
        categories={categories}
        isSubmitting={moveDocuments.isPending}
        onClose={() => setMoveModalDocs(null)}
        onConfirm={handleConfirmMove}
      />

      <DocumentViewerModal
        open={Boolean(viewer)}
        documentId={viewer?.documentId ?? null}
        initialVersionId={viewer?.versionId}
        initialShowDetails={viewer?.mode === 'details'}
        onClose={() => setViewer(null)}
        onUpdateDocument={openUpdateVersionDrawer}
      />
    </DndContext>
    </ExplorerActionsProvider>
  );
}
