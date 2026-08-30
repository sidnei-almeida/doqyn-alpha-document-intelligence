import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { formatDateTime } from '@/lib/utils';
import type { DocumentListItem } from '@/types/document-library';

/**
 * Qual documento, antes de para quem.
 *
 * Compartilhar e pedir assinatura começam por um documento — a tela de contatos começa por uma
 * pessoa, e é este passo que costura os dois sentidos. Sem ele, a ação partiria de uma pessoa e
 * chegaria a um modal sem objeto.
 *
 * **Não é a Biblioteca.** Não tem pasta, filtro, ordenação nem ação por linha: é uma escolha
 * única, e cada recurso a mais aqui seria um jeito de sair do que se veio fazer.
 */
export function PickDocumentDialog({
  open,
  recipientName,
  verb,
  onClose,
  onPick,
}: {
  open: boolean;
  recipientName: string;
  verb: 'compartilhar' | 'assinatura';
  onClose: () => void;
  onPick: (document: DocumentListItem) => void;
}) {
  const [query, setQuery] = useState('');

  const documents = useDocuments(
    { sort: 'updatedAt', direction: 'desc', limit: '100', excludeArchived: 'true' },
    { enabled: open, listScopeKey: 'contact-pick' },
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = documents.data ?? [];
    if (!q) return items;
    return items.filter((item) =>
      [item.displayName, item.currentFileName].some((value) => value?.toLowerCase().includes(q)),
    );
  }, [documents.data, query]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={verb === 'compartilhar' ? 'Compartilhar qual documento?' : 'Assinar qual documento?'}
      subtitle={
        verb === 'compartilhar'
          ? `Escolha o documento que vai para ${recipientName}.`
          : `Escolha o documento que ${recipientName} vai assinar.`
      }
      size="md"
    >
      <div className="flex flex-col gap-3">
        <Input
          variant="rule"
          label="Buscar documento"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nome do arquivo"
          autoComplete="off"
        />

        {documents.isLoading ? (
          <p className="type-caption py-2 text-doqyn-muted">Carregando…</p>
        ) : results.length === 0 ? (
          <p className="type-caption py-2 text-doqyn-muted">
            {query ? 'Nenhum documento com esse nome.' : 'Você ainda não tem documentos.'}
          </p>
        ) : (
          // Altura travada com rolagem própria: cem documentos não podem esticar o modal para
          // fora da tela.
          <ul className="max-h-80 overflow-y-auto border-t border-doqyn-border-subtle">
            {results.map((item) => (
              <li key={item.id} className="border-b border-doqyn-border-subtle">
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  className="explorer-interactive relative flex w-full flex-col items-start rounded-none px-1 py-2 text-left before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-transparent hover:bg-doqyn-hover/50 hover:before:bg-doqyn-accent-active"
                >
                  <span className="type-body line-clamp-1 text-doqyn-text">
                    {item.displayName || item.currentFileName}
                  </span>
                  <span className="register-label text-doqyn-subtle">
                    {item.categoryName ? `${item.categoryName} · ` : ''}
                    {formatDateTime(item.updatedAt ?? item.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
