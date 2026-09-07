import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { VersionBadge } from '@/components/ui/VersionBadge';
import { cn } from '@/lib/utils';

type TrackingDocumentCellProps = {
  name: string;
  versionLabel?: string;
  /** Usado quando o evento não carrega o rótulo da versão. */
  versionId?: string | null;
  className?: string;
  /** Quando presente, o nome vira atalho para abrir o documento na Biblioteca. */
  documentId?: string;
};

export function TrackingDocumentCell({
  name,
  versionLabel,
  versionId,
  className,
  documentId,
}: TrackingDocumentCellProps) {
  // Evento antigo pode não ter o rótulo, mas tem o id: o prefixo curto ainda
  // diz qual versão foi tocada, que é a pergunta que a trilha responde.
  const version = versionLabel ?? (versionId ? versionId.slice(0, 8) : undefined);

  return (
    <div
      className={cn(
        'tracking-document-cell flex min-w-0 max-w-[min(100%,28rem)] items-center gap-1.5',
        className,
      )}
    >
      {documentId ? (
        // Investigar um evento quase sempre termina em "deixa eu ver esse documento". Sem o
        // atalho, o caminho era copiar o nome e procurar na Biblioteca.
        <Link
          to={`/biblioteca?preview=${encodeURIComponent(documentId)}`}
          // A linha inteira abre o detalhe no lugar; o nome continua sendo
          // atalho para o documento, e não pode disparar as duas coisas.
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          className="tracking-document-name group flex min-w-0 items-center gap-1 text-sm text-doqyn-text hover:text-doqyn-info"
          title="Abrir documento"
        >
          <TruncatedText className="min-w-0">{name}</TruncatedText>
          <Icon
            name="open_in_new"
            size={ICON_SIZE.xs}
            className="shrink-0 text-doqyn-subtle opacity-0 transition-opacity group-hover:opacity-100"
          />
        </Link>
      ) : (
        <TruncatedText className="tracking-document-name text-sm text-doqyn-text">
          {name}
        </TruncatedText>
      )}
      {version ? (
        <VersionBadge version={version} size="xs" className="tracking-document-version shrink-0" />
      ) : null}
    </div>
  );
}
