import { WorkspaceSideDrawer } from '@/components/layout/WorkspaceSideDrawer';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { IconButton } from '@/components/ui/IconButton';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { DocumentExpiryEditor } from '@/features/expiry/components/DocumentExpiryEditor';
import type { DocumentListItem } from '@/types/document-library';
import { DocumentNameField } from './DocumentNameField';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('library');

  if (!document) return null;

  const fileName = document.currentFileName ?? document.displayName ?? document.documentId;
  const canEditMetadata = Boolean(document.permissions?.canEditMetadata);

  return (
    <WorkspaceSideDrawer
      title={t('documentMetadataDrawer.metadadosDoDocumento')}
      onClose={onClose}
      testId="document-metadata-drawer"
      zIndexClass="z-[95]"
      header={
        <header className="flex items-start justify-between gap-3 border-b border-doqyn-border-subtle px-5 py-4">
          <div className="min-w-0 flex-1">
            {/* O eyebrow era acento; acento é para o que se clica. */}
            <p className="register-label text-doqyn-subtle">
              {t('documentMetadataDrawer.metadados')}
            </p>
            <TruncatedText as="h2" className="type-h2 mt-1 text-doqyn-text">
              {fileName}
            </TruncatedText>
            <p className="mt-1 text-caption text-doqyn-muted">
              {document.categoryName ?? 'Sem categoria'}
            </p>
          </div>
          <IconButton label={t('documentMetadataDrawer.fecharMetadados')} onClick={onClose}>
            <Icon name="close" size={ICON_SIZE.sm} />
          </IconButton>
        </header>
      }
    >
      <div className="space-y-4">
        <DocumentNameField
          documentId={document.documentId}
          fileName={fileName}
          canEdit={canEditMetadata}
        />
        <DocumentExpiryEditor documentId={document.documentId} canEdit={canEditMetadata} />
      </div>
    </WorkspaceSideDrawer>
  );
}
