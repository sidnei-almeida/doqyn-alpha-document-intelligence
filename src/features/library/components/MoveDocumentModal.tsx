import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ICON_SIZE } from '@/lib/iconDefaults';
import type { DocumentListItem } from '@/types/document-library';

export type MoveDocumentCategoryOption = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
};

type MoveDocumentModalProps = {
  open: boolean;
  documents: DocumentListItem[];
  categories: MoveDocumentCategoryOption[];
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (targetClassId: string) => void;
};

export function MoveDocumentModal({
  open,
  documents,
  categories,
  isSubmitting = false,
  onClose,
  onConfirm,
}: MoveDocumentModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.id && category.name),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeCategories;
    return activeCategories.filter(
      (category) =>
        category.name.toLowerCase().includes(query) || category.slug?.toLowerCase().includes(query),
    );
  }, [activeCategories, search]);

  const singleDoc = documents.length === 1 ? documents[0] : null;
  const currentCategoryId = singleDoc?.categoryId ?? null;
  const currentCategoryName = singleDoc?.categoryName ?? null;
  const allSameCategory =
    documents.length > 0 && documents.every((doc) => doc.categoryId === documents[0]?.categoryId);

  const selectedCategory = activeCategories.find((category) => category.id === selectedId) ?? null;
  const isSameAsCurrent =
    Boolean(selectedId) &&
    allSameCategory &&
    currentCategoryId != null &&
    selectedId === currentCategoryId;

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedId(null);
      return;
    }
    if (singleDoc?.categoryId) {
      const firstDifferent = activeCategories.find(
        (category) => category.id !== singleDoc.categoryId,
      );
      setSelectedId(firstDifferent?.id ?? activeCategories[0]?.id ?? null);
    } else {
      setSelectedId(activeCategories[0]?.id ?? null);
    }
  }, [open, singleDoc?.categoryId, activeCategories]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const title = documents.length > 1 ? `Mover ${documents.length} documentos` : 'Mover documento';

  const canSubmit =
    Boolean(selectedId) && !isSubmitting && !isSameAsCurrent && activeCategories.length > 0;

  return (
    <div
      ref={overlayRef}
      onClick={(event) => event.target === overlayRef.current && onClose()}
      className="modal-overlay-scrim fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-document-modal-title"
      data-testid="move-document-modal"
    >
      <div className="flex w-full max-w-md flex-col rounded-xl border border-doqyn-border bg-doqyn-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-doqyn-border-subtle px-5 py-4">
          <div className="min-w-0">
            <h2 id="move-document-modal-title" className="text-base font-semibold text-doqyn-text">
              {title}
            </h2>
            <p className="mt-1 text-caption leading-relaxed text-doqyn-subtle">
              {documents.length > 1
                ? 'Os documentos selecionados serão reclassificados para a categoria escolhida.'
                : 'Escolha uma nova categoria para este documento. O arquivo e o histórico serão preservados.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-doqyn-muted hover:text-doqyn-text"
            aria-label="Fechar"
          >
            <Icon name="close" size={ICON_SIZE.md} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {singleDoc && currentCategoryName && (
            <div className="rounded-lg border border-doqyn-border-subtle bg-doqyn-card px-3 py-2.5">
              <p className="text-eyebrow uppercase text-doqyn-subtle">Categoria atual</p>
              <p className="mt-0.5 text-label text-doqyn-text">{currentCategoryName}</p>
            </div>
          )}

          {activeCategories.length === 0 ? (
            <p className="text-label font-normal text-doqyn-subtle">
              Nenhuma categoria disponível.
            </p>
          ) : (
            <>
              {activeCategories.length > 6 && (
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar categoria…"
                  aria-label="Buscar categoria"
                />
              )}

              <div className="max-h-64 space-y-1 overflow-y-auto pr-0.5">
                {filteredCategories.length === 0 ? (
                  <p className="text-label font-normal text-doqyn-subtle">
                    Nenhuma categoria encontrada.
                  </p>
                ) : (
                  filteredCategories.map((category) => {
                    const isCurrent = category.id === currentCategoryId;
                    const isSelected = category.id === selectedId;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedId(category.id)}
                        className={[
                          'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                          isSelected
                            ? 'border-doqyn-accent-active/40 bg-doqyn-accent-active/8'
                            : 'border-transparent hover:border-doqyn-border-subtle hover:bg-doqyn-surface-hover',
                        ].join(' ')}
                        aria-pressed={isSelected}
                      >
                        <Icon
                          name="folder"
                          size={ICON_SIZE.sm}
                          className="shrink-0 text-doqyn-subtle"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-label text-doqyn-text">
                            {category.name}
                          </span>
                          {category.description ? (
                            <span className="block truncate text-micro text-doqyn-subtle">
                              {category.description}
                            </span>
                          ) : null}
                        </span>
                        {isCurrent ? (
                          <span className="shrink-0 rounded-full bg-doqyn-card px-2 py-0.5 text-micro font-medium text-doqyn-subtle">
                            Atual
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>

              {isSameAsCurrent && (
                <p className="text-caption text-doqyn-warning">
                  O documento já está nesta categoria.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-doqyn-border-subtle px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => selectedId && onConfirm(selectedId)}
            disabled={!canSubmit}
          >
            {selectedCategory ? `Mover para ${selectedCategory.name}` : 'Mover'}
          </Button>
        </div>
      </div>
    </div>
  );
}
