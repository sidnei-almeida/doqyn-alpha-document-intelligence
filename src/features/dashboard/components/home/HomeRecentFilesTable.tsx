import { useNavigate } from 'react-router-dom';
import { FileTypeIcon } from '@/components/ui/FileTypeIcon';
import { Icon } from '@/components/ui/Icon';
import { TableRowActionsMenu } from '@/components/ui/TableRowActionsMenu';
import { Tooltip } from '@/components/ui/Tooltip';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn, formatDate } from '@/lib/utils';
import type { DocumentListItem } from '@/types/document-library';
import { formatStorageBytes } from '../../utils/buildOverviewMetrics';

type HomeRecentFilesTableProps = {
  documents: DocumentListItem[];
  selectedDocumentId: string | null;
  onSelect: (doc: DocumentListItem) => void;
  onOpen: (doc: DocumentListItem) => void;
  onChat: (doc: DocumentListItem) => void;
};

/** Tabela de arquivos recentes — Nome / Proprietário / Modificado / Tamanho, estilo Drive. */
export function HomeRecentFilesTable({
  documents,
  selectedDocumentId,
  onSelect,
  onOpen,
  onChat,
}: HomeRecentFilesTableProps) {
  const navigate = useNavigate();

  return (
    <section aria-label="Documentos recentes">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="type-h2">Recentes</h2>
        <button
          type="button"
          onClick={() => navigate('/library')}
          className="font-display text-label font-medium text-doqyn-primary hover:underline"
        >
          Abrir biblioteca
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-doqyn-border-subtle bg-doqyn-surface">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr className="border-b border-doqyn-border-subtle">
              <th className="type-label px-4 py-3 text-left text-doqyn-muted">
                <span className="inline-flex items-center gap-1">
                  Nome
                  <Icon name="arrow_upward" size={13} />
                </span>
              </th>
              <th className="type-label px-4 py-3 text-left text-doqyn-muted">Proprietário</th>
              <th className="type-label whitespace-nowrap px-4 py-3 text-left text-doqyn-muted">
                Modificado
              </th>
              <th className="type-label whitespace-nowrap px-4 py-3 text-left text-doqyn-muted">
                Tamanho
              </th>
              <th className="w-12 px-2 py-3" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.documentId}
                onClick={() => onSelect(doc)}
                onDoubleClick={() => doc.permissions?.canPreview && onOpen(doc)}
                className={cn(
                  'cursor-pointer border-b border-doqyn-border-subtle transition-colors last:border-b-0',
                  selectedDocumentId === doc.documentId
                    ? 'bg-doqyn-selected'
                    : 'hover:bg-doqyn-surface-hover',
                )}
              >
                <td className="max-w-0 px-4 py-3">
                  <span className="flex items-center gap-3">
                    <FileTypeIcon fileName={doc.currentFileName} size={20} />
                    <span className="table-text truncate text-doqyn-text">{doc.displayName}</span>
                    {doc.isFavorite && (
                      <Icon
                        name="star"
                        filled
                        size={14}
                        className="shrink-0 text-doqyn-warning-dot"
                      />
                    )}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Tooltip label={doc.ownerName ?? 'Proprietário'}>
                    <span className="inline-flex items-center gap-2">
                      <UserAvatar userId={doc.ownerUserId} name={doc.ownerName} size="sm" />
                      <span className="table-text hidden text-doqyn-muted lg:inline">
                        {doc.ownerName ?? '—'}
                      </span>
                    </span>
                  </Tooltip>
                </td>
                <td className="table-text whitespace-nowrap px-4 py-3 text-doqyn-muted">
                  {formatDate(doc.updatedAt)}
                </td>
                <td className="table-text whitespace-nowrap px-4 py-3 text-doqyn-muted">
                  {typeof doc.fileSizeBytes === 'number'
                    ? formatStorageBytes(doc.fileSizeBytes)
                    : '—'}
                </td>
                <td className="px-2 py-3">
                  <TableRowActionsMenu
                    actions={[
                      {
                        label: 'Abrir',
                        onClick: () => onOpen(doc),
                        hidden: !doc.permissions?.canPreview,
                      },
                      { label: 'Ver detalhes', onClick: () => onSelect(doc) },
                      {
                        label: 'Conversar',
                        onClick: () => onChat(doc),
                        hidden: !doc.permissions?.canPreview,
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
