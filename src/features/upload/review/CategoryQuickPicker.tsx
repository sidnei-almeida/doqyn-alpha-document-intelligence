import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import {
  createDocumentCategoryFromSuggestion,
  fetchDocumentCategories,
} from '@/features/documents/api/documentsApi';
import type { SuggestedCategory } from '@/features/document-send/services/analyzePdf';
import { EmptyHint } from '@/components/ui/EmptyHint';
import { useTranslation } from 'react-i18next';

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
  suggestion,
  canCreateCategory = false,
}: {
  selectedClassId?: string;
  onSelect: (classId: string, className: string) => void;
  /** Categoria que a IA sugeriu, quando houve alguma. Ganha destaque de atalho. */
  suggestedClassId?: string | null;
  /**
   * Pasta que a IA propôs criar, quando nenhuma das existentes serviu.
   *
   * Vem do terceiro passe da classificação. Ainda não existe no banco: é um rascunho.
   */
  suggestion?: SuggestedCategory | null;
  /**
   * Se quem revisa pode criar categoria. A rota é de administrador; sem isso o botão devolveria
   * 403, então quem não administra vê a proposta como texto e escolhe entre as pastas existentes.
   */
  canCreateCategory?: boolean;
}) {
  const { t } = useTranslation('upload');
  const queryClient = useQueryClient();

  const [term, setTerm] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['document-categories-options'],
    queryFn: fetchDocumentCategories,
    staleTime: 5 * 60_000,
  });

  const handleCreateSuggested = async () => {
    if (!suggestion || creating) return;

    setCreating(true);
    try {
      const created = await createDocumentCategoryFromSuggestion({
        name: suggestion.name,
        description: suggestion.description,
        keywords: suggestion.keywords,
      });

      // A lista precisa conhecer a pasta nova antes de o drawer marcar a escolha — senão o chip
      // selecionado não aparece e parece que o clique não fez nada.
      await queryClient.invalidateQueries({ queryKey: ['document-categories-options'] });
      onSelect(created.id, created.name);
    } catch (error) {
      // A mensagem do servidor é em pt-BR e vem com código; a genérica é a traduzida. Erro de
      // contrato (resposta sem id) não tem texto de tela, então cai na genérica.
      const serverMessage =
        error instanceof Error && error.message && !/^[A-Z_]+$/.test(error.message)
          ? error.message
          : null;
      toast.error(serverMessage ?? t('categoryQuickPicker.suggestion.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  /**
   * O bloco da proposta, acima da lista.
   *
   * Vem primeiro porque é a resposta à pergunta que trouxe a pessoa até aqui: nenhuma pasta
   * serviu. Oferecer a lista antes seria pedir que ela escolha de novo entre as opções que a IA
   * já descartou.
   */
  const suggestionBlock = suggestion ? (
    <div className="mb-2.5 rounded-[4px] border border-doqyn-border-subtle bg-doqyn-surface px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-doqyn-muted">
        {t('categoryQuickPicker.suggestion.eyebrow')}
      </p>
      <p className="mt-0.5 text-[12px] font-medium text-doqyn-text">{suggestion.name}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-doqyn-muted">
        {suggestion.description}
      </p>
      {canCreateCategory ? (
        <button
          type="button"
          onClick={() => void handleCreateSuggested()}
          disabled={creating}
          className="mt-2 inline-flex items-center gap-1.5 rounded-[4px] border border-doqyn-primary px-2.5 py-1 text-[12px] font-medium text-doqyn-text transition-colors hover:bg-doqyn-primary/10 disabled:opacity-60"
          data-testid="category-quick-pick-create-suggested"
        >
          {creating ? (
            <Icon name="progress_activity" size={ICON_SIZE.xs} className="animate-spin" />
          ) : (
            <Icon name="create_new_folder" size={ICON_SIZE.xs} />
          )}
          {t('categoryQuickPicker.suggestion.createButton', { name: suggestion.name })}
        </button>
      ) : (
        <p className="mt-1.5 text-[10px] text-doqyn-muted">
          {t('categoryQuickPicker.suggestion.adminOnly')}
        </p>
      )}
    </div>
  ) : null;

  const filtered = useMemo(() => {
    const normalized = term.trim().toLowerCase();
    if (!normalized) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(normalized));
  }, [categories, term]);

  if (isLoading) {
    return (
      <p className="text-[11px] text-doqyn-muted">
        {t('categoryQuickPicker.carregandoCategorias')}
      </p>
    );
  }

  // Tenant sem nenhuma categoria é exatamente onde a proposta mais vale: antes, a revisão só
  // dizia "nenhuma categoria configurada" e mandava a pessoa sair da tela para criar uma.
  if (categories.length === 0) {
    return (
      <div>
        {suggestionBlock}
        <EmptyHint bare>{t('categoryQuickPicker.nenhumaCategoriaConfiguradaCrie')}</EmptyHint>
      </div>
    );
  }

  return (
    <div>
      {suggestionBlock}
      {categories.length > SEARCH_THRESHOLD && (
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t('categoryQuickPicker.filtrarCategorias')}
          className="mb-2 w-full rounded-md border border-doqyn-border-subtle bg-doqyn-bg px-2.5 py-1.5 text-[12px] text-doqyn-text placeholder:text-doqyn-subtle"
          aria-label={t('categoryQuickPicker.filtrarCategorias2')}
        />
      )}

      <div
        className="flex flex-wrap gap-1.5"
        role="listbox"
        aria-label={t('categoryQuickPicker.categorias')}
      >
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
              {isSelected && (
                <Icon name="check" size={ICON_SIZE.xs} className="text-doqyn-primary" />
              )}
              {category.name}
              {isSuggested && !isSelected && (
                <span className="text-doqyn-accent text-[10px] uppercase tracking-wide">IA</span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyHint bare className="mt-2">
          {t('categoryQuickPicker.nenhumaCategoriaComEsse')}
        </EmptyHint>
      )}
    </div>
  );
}
