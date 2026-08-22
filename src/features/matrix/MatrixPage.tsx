import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { fetchDocumentCategories } from '@/features/documents/api/documentsApi';
import { createDocumentShare, revokeDocumentShare } from '@/features/sharing/api/shareApi';
import { fetchAccessMatrix } from './api/matrixApi';
import { AccessMatrixTable } from './components/AccessMatrixTable';
import { GroupAccessMatrixTable } from './components/GroupAccessMatrixTable';

/**
 * Matriz de documentos.
 *
 * Responde a pergunta que a Biblioteca não responde: quem alcança cada documento, e por qual
 * caminho. Duas leituras da mesma verdade — por pessoa, para conferir caso a caso, e por grupo,
 * para governar, porque pessoa entra e sai de grupo o tempo todo e a regra é o que permanece.
 *
 * Metadados ficaram de fora de propósito: cada tipo de documento tem campos diferentes, então a
 * ficha é por documento (botão no próprio arquivo), não uma coluna que só existe para um tipo.
 */
type MatrixTab = 'people' | 'groups';

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
  const [tab, setTab] = useState<MatrixTab>('people');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [busyCellKey, setBusyCellKey] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['document-categories-options'],
    queryFn: fetchDocumentCategories,
    staleTime: 5 * 60_000,
  });

  const accessQuery = useQuery({
    queryKey: ['matrix-access', search, categoryId],
    queryFn: () =>
      fetchAccessMatrix({ search: search || undefined, categoryId: categoryId || undefined }),
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

  const isLoading = accessQuery.isLoading;
  const error = accessQuery.error;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <header>
        <h1 className="text-[18px] font-semibold text-doqyn-text">Matriz de documentos</h1>
        <p className="mt-0.5 text-[12px] text-doqyn-muted">
          Quem alcança cada documento, e por qual caminho.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:max-w-2xl">
        <TabButton
          active={tab === 'people'}
          onClick={() => setTab('people')}
          icon="group"
          label="Por pessoa"
          hint="Quem lê cada documento, e de onde vem o acesso"
        />
        <TabButton
          active={tab === 'groups'}
          onClick={() => setTab('groups')}
          icon="admin_panel_settings"
          label="Por grupo"
          hint="O que a regra concede a cada grupo, verbo a verbo"
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
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="rounded-lg border border-doqyn-border-subtle bg-doqyn-bg px-2.5 py-1.5 text-[13px] text-doqyn-text"
          aria-label="Categoria"
        >
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        {accessQuery.data && (
          <span className="text-[11px] text-doqyn-subtle">
            {accessQuery.data.documents.length} documento
            {accessQuery.data.documents.length === 1 ? '' : 's'} ·{' '}
            {tab === 'people'
              ? `${accessQuery.data.members.length} pessoa${accessQuery.data.members.length === 1 ? '' : 's'}`
              : `${accessQuery.data.groups.length} grupo${accessQuery.data.groups.length === 1 ? '' : 's'}`}
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

        {!isLoading && !error && tab === 'people' && accessQuery.data && (
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

        {!isLoading && !error && tab === 'groups' && accessQuery.data && (
          <GroupAccessMatrixTable matrix={accessQuery.data} />
        )}
      </div>
    </div>
  );
}

export default MatrixPage;
