import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { fetchDocumentCategories } from '@/features/documents/api/documentsApi';

/**
 * Escolha de categoria em um clique.
 *
 * Quando a IA não consegue classificar, o documento ficava sem saída: a confirmação exige uma
 * classe e a análise não tinha nenhuma para dar. O resgate precisa custar um clique — quem está
 * revisando um lote não vai abrir formulário, procurar campo e digitar nome de pasta a cada
 * arquivo. Por isso: lista das categorias da empresa, cada uma um botão, e a busca só aparece
 * quando a lista é grande demais para varrer com o olho.
 */
const SEARCH_THRESHOLD = 8;

export function CategoryQuickPicker({
  selectedClassId,
  onSelect,
  suggestedClassId,
}: {
  selectedClassId?: string;
  onSelect: (classId: string, className: string) => void;
  /** Categoria que a IA sugeriu, quando houve alguma. Ganha destaque de atalho. */
  suggestedClassId?: string | null;
}) {
  const [term, setTerm] = useState('');

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['document-categories-options'],
    queryFn: fetchDocumentCategories,
    staleTime: 5 * 60_000,
  });

  const filtered = useMemo(() => {
    const normalized = term.trim().toLowerCase();
    if (!normalized) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(normalized));
  }, [categories, term]);

  if (isLoading) {
    return <p className="text-[11px] text-doqyn-muted">Carregando categorias…</p>;
  }

  if (categories.length === 0) {
    return (
      <p className="text-[11px] text-doqyn-muted">
        Nenhuma categoria configurada para a empresa. Crie uma em Regras antes de classificar à mão.
      </p>
    );
  }

  return (
    <div>
      {categories.length > SEARCH_THRESHOLD && (
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Filtrar categorias"
          className="mb-2 w-full rounded-md border border-doqyn-border-subtle bg-doqyn-bg px-2.5 py-1.5 text-[12px] text-doqyn-text placeholder:text-doqyn-subtle"
          aria-label="Filtrar categorias"
        />
      )}

      <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Categorias da empresa">
        {filtered.map((category) => {
          const isSelected = category.id === selectedClassId;
          const isSuggested = category.id === suggestedClassId;

          return (
            <button
              key={category.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(category.id, category.name)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                isSelected
                  ? 'border-doqyn-primary bg-doqyn-primary/10 font-medium text-doqyn-text'
                  : 'border-doqyn-border-subtle text-doqyn-muted hover:border-doqyn-primary/40 hover:text-doqyn-text',
              )}
              data-testid={`category-quick-pick-${category.id}`}
            >
              {isSelected && <Icon name="check" size={ICON_SIZE.xs} className="text-doqyn-primary" />}
              {category.name}
              {isSuggested && !isSelected && (
                <span className="text-[10px] uppercase tracking-wide text-doqyn-accent">IA</span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-2 text-[11px] text-doqyn-muted">Nenhuma categoria com esse nome.</p>
      )}
    </div>
  );
}
