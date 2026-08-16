import { WorkspaceSideDrawer } from '@/components/layout/WorkspaceSideDrawer';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { DocumentExpiryEditor } from '@/features/expiry/components/DocumentExpiryEditor';
import type { DocumentListItem } from '@/types/document-library';

/**
 * Ficha de metadados do documento, aberta da própria Biblioteca.
 *
 * Fica por documento, e não numa matriz de colunas, porque cada tipo de documento tem campos
 * diferentes: as colunas de um contrato não são as de uma nota fiscal, e uma tabela que tentasse
 * servir aos dois viraria um mar de células vazias.
 */
export function DocumentMetadataDrawer({
  document,
  onClose,
}: {
  document: DocumentListItem | null;
  onClose: () => void;
}) {
  if (!document) return null;

  return (
    <WorkspaceSideDrawer
      title="Metadados do documento"
      onClose={onClose}
      testId="document-metadata-drawer"
      zIndexClass="z-[95]"
      header={
        <header className="border-b border-doqyn-border-subtle px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-doqyn-primary">
            Metadados
          </p>
          <TruncatedText as="h2" className="mt-0.5 text-[14px] font-semibold text-doqyn-text">
            {document.currentFileName ?? document.displayName ?? document.documentId}
          </TruncatedText>
          <p className="mt-0.5 text-[11px] text-doqyn-muted">
            {document.categoryName ?? 'Sem categoria'}
          </p>
        </header>
      }
    >
      <div className="px-4 py-3">
        <DocumentExpiryEditor
          documentId={document.documentId}
          canEdit={Boolean(document.permissions?.canEditMetadata)}
        />
      </div>
    </WorkspaceSideDrawer>
  );
}
