import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { fetchDocumentCategories } from '@/features/documents/api/documentsApi';
import { createDocumentShare, revokeDocumentShare } from '@/features/sharing/api/shareApi';
import {
  fetchAccessMatrix,
  fetchMetadataMatrix,
  updateDocumentMetadataField,
  type MetadataMatrixColumn,
} from './api/matrixApi';
import { AccessMatrixTable } from './components/AccessMatrixTable';
import { MetadataMatrixTable } from './components/MetadataMatrixTable';

/**
 * Matriz de documentos.
 *
 * Duas perguntas que a Biblioteca não responde: "quem alcança cada documento, e por quê" e "quais
 * documentos desta categoria estão com campo faltando". São matrizes separadas porque as colunas
 * são de naturezas diferentes — pessoas de um lado, campos da categoria do outro — e misturar as
 * duas produziria uma tabela que não serve para nenhuma das duas perguntas.
 */
type MatrixTab = 'access' | 'metadata';

function TabButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
        active
          ? 'border-doqyn-primary/40 bg-doqyn-primary/5'
          : 'border-doqyn-border-subtle hover:bg-doqyn-surface-hover',
      )}
      aria-pressed={active}
    >
      <Icon
        name={icon}
        size={ICON_SIZE.sm}
        className={active ? 'text-doqyn-primary' : 'text-doqyn-muted'}
      />
      <span className="min-w-0">
        <span
          className={cn(
            'block text-[13px] font-medium',
            active ? 'text-doqyn-text' : 'text-doqyn-muted',
          )}
        >
          {label}
        </span>
        <span className="block text-[11px] text-doqyn-subtle">{hint}</span>
      </span>
    </button>
  );
}

export function MatrixPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MatrixTab>('access');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [busyCellKey, setBusyCellKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['document-categories-options'],
    queryFn: fetchDocumentCategories,
    staleTime: 5 * 60_000,
  });

  // A matriz de metadados exige categoria: as colunas saem da regra dela. Sem escolha explícita,
  // a primeira categoria é um ponto de partida melhor que uma tela vazia.
  const metadataCategoryId = categoryId || categories[0]?.id || '';

  const accessQuery = useQuery({
    queryKey: ['matrix-access', search, categoryId],
    queryFn: () => fetchAccessMatrix({ search: search || undefined, categoryId: categoryId || undefined }),
    enabled: tab === 'access',
  });

  const metadataQuery = useQuery({
    queryKey: ['matrix-metadata', metadataCategoryId, search],
    queryFn: () => fetchMetadataMatrix({ categoryId: metadataCategoryId, search: search || undefined }),
    enabled: tab === 'metadata' && Boolean(metadataCategoryId),
  });

  const shareMutation = useMutation({
    mutationFn: (input: { documentId: string; userId: string }) =>
      createDocumentShare(input.documentId, {
        sharedWithUserId: input.userId,
        permissions: { canView: true, canDownload: true },
      }),
    onSuccess: () => {
      toast.success('Compartilhamento criado.');
      void queryClient.invalidateQueries({ queryKey: ['matrix-access'] });
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setBusyCellKey(null),
  });

  const revokeMutation = useMutation({
    mutationFn: (input: { documentId: string; shareId: string }) =>
      revokeDocumentShare(input.documentId, input.shareId),
    onSuccess: () => {
      toast.success('Compartilhamento revogado.');
      void queryClient.invalidateQueries({ queryKey: ['matrix-access'] });
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setBusyCellKey(null),
  });

  const metadataMutation = useMutation({
    mutationFn: (input: {
      documentId: string;
      column: MetadataMatrixColumn;
      value: string;
    }) =>
      updateDocumentMetadataField({
        documentId: input.documentId,
        key: input.column.key,
        label: input.column.label,
        value: input.value === '' ? null : input.value,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['matrix-metadata'] });
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setSavingKey(null),
  });

  const activeCategoryName = useMemo(
    () => categories.find((category) => category.id === metadataCategoryId)?.name,
    [categories, metadataCategoryId],
  );

  const isLoading = tab === 'access' ? accessQuery.isLoading : metadataQuery.isLoading;
  const error = tab === 'access' ? accessQuery.error : metadataQuery.error;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <header>
        <h1 className="text-[18px] font-semibold text-doqyn-text">Matriz de documentos</h1>
        <p className="mt-0.5 text-[12px] text-doqyn-muted">
          Quem alcança cada documento e o que está preenchido — em uma tela só.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:max-w-2xl">
        <TabButton
          active={tab === 'access'}
          onClick={() => setTab('access')}
          icon="admin_panel_settings"
          label="Acesso"
          hint="Quem lê cada documento, e por qual caminho"
        />
        <TabButton
          active={tab === 'metadata'}
          onClick={() => setTab('metadata')}
          icon="table_rows"
          label="Metadados"
          hint="Campos da categoria, lado a lado e editáveis"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 sm:max-w-xs">
          <Icon
            name="search"
            size={ICON_SIZE.sm}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-doqyn-subtle"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar documento"
            className="w-full rounded-lg border border-doqyn-border-subtle bg-doqyn-bg py-1.5 pl-8 pr-3 text-[13px] text-doqyn-text placeholder:text-doqyn-subtle"
          />
        </label>

        <select
          value={tab === 'metadata' ? metadataCategoryId : categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="rounded-lg border border-doqyn-border-subtle bg-doqyn-bg px-2.5 py-1.5 text-[13px] text-doqyn-text"
          aria-label="Categoria"
        >
          {tab === 'access' && <option value="">Todas as categorias</option>}
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        {tab === 'metadata' && activeCategoryName && (
          <span className="text-[11px] text-doqyn-subtle">
            Colunas definidas pela regra de {activeCategoryName}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading && (
          <div className="rounded-xl border border-doqyn-border-subtle px-6 py-12 text-center">
            <Icon
              name="progress_activity"
              size={24}
              className="mx-auto animate-spin text-doqyn-muted"
            />
            <p className="mt-2 text-[12px] text-doqyn-muted">Montando a matriz…</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-xl border border-doqyn-danger-border bg-doqyn-danger-bg px-6 py-8 text-center">
            <p className="text-[13px] text-doqyn-danger">{(error as Error).message}</p>
          </div>
        )}

        {!isLoading && !error && tab === 'access' && accessQuery.data && (
          <AccessMatrixTable
            matrix={accessQuery.data}
            busyCellKey={busyCellKey}
            onShare={(documentId, member) => {
              const cellKey = `${documentId}:${member.userId}`;
              setBusyCellKey(cellKey);
              shareMutation.mutate({ documentId, userId: member.userId });
            }}
            onRevoke={(documentId, shareGrantId) => {
              setBusyCellKey(`${documentId}:${shareGrantId}`);
              revokeMutation.mutate({ documentId, shareId: shareGrantId });
            }}
          />
        )}

        {!isLoading && !error && tab === 'metadata' && metadataQuery.data && (
          <MetadataMatrixTable
            matrix={metadataQuery.data}
            savingKey={savingKey}
            onCommitField={(input) => {
              setSavingKey(`${input.documentId}:${input.column.key}`);
              metadataMutation.mutate(input);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default MatrixPage;
