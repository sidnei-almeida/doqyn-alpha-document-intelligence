import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/PageShell';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { DropdownMenuItem } from '@/components/ui/DropdownMenuItem';
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

/**
 * Lente — não é aba nem cartão: é a escolha de por onde ler a mesma grade. Como
 * é controle horizontal, o escolhido marca com régua de acento embaixo.
 */
function LensOption({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button type="button" onClick={onClick} className="matrix-lens" aria-pressed={active}>
      <span
        className={cn(
          'block text-label font-medium transition-colors',
          active ? 'text-doqyn-text' : 'text-doqyn-muted',
        )}
      >
        {label}
      </span>
      <span className="mt-0.5 block text-caption text-doqyn-subtle">{hint}</span>
    </button>
  );
}

/** Filtro de categoria — mesma anatomia dos filtros da Biblioteca: texto e fio. */
function CategoryFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const isActive = value !== '';
  const label = options.find((option) => option.value === value)?.label ?? 'Todas as categorias';

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={
          isActive ? 'explorer-filter-chip explorer-filter-chip--active' : 'explorer-filter-chip'
        }
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Filtrar por categoria"
      >
        <span className="max-w-[11rem] truncate">{label}</span>
        <Icon
          name="keyboard_arrow_down"
          size={ICON_SIZE.xs}
          className={cn('shrink-0 opacity-70 transition-transform', open && 'rotate-180')}
        />
      </button>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        role="listbox"
        aria-label="Categoria"
        className="min-w-[12rem] max-w-[min(18rem,calc(100vw-1rem))] py-1"
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            selected={option.value === value}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </AnchoredPopover>
    </div>
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
  const data = accessQuery.data;

  const documentCount = data?.documents.length ?? 0;
  const axisCount = tab === 'people' ? (data?.members.length ?? 0) : (data?.groups.length ?? 0);
  const axisNoun = tab === 'people' ? 'pessoa' : 'grupo';

  return (
    <PageShell
      eyebrow="Governança"
      title="Matriz de documentos"
      description="Quem alcança cada documento, e por qual caminho."
      bodyClassName="matrix-page w-full gap-6"
    >
      <div className="flex flex-col gap-3">
        <span className="font-mono text-micro uppercase tracking-[0.14em] text-doqyn-subtle">
          Lente
        </span>
        <div className="grid max-w-2xl gap-x-8 gap-y-3 sm:grid-cols-2">
          <LensOption
            active={tab === 'people'}
            onClick={() => setTab('people')}
            label="Por pessoa"
            hint="Quem lê cada documento, e de onde vem o acesso"
          />
          <LensOption
            active={tab === 'groups'}
            onClick={() => setTab('groups')}
            label="Por grupo"
            hint="O que a regra concede a cada grupo, verbo a verbo"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        {/* "Buscar na matriz", e não "Buscar documento": a busca do topo abre o
            documento, esta reduz a grade. Dois campos com o mesmo rótulo na
            mesma tela ensinam que fazem a mesma coisa. */}
        <label className="field-rule w-full sm:max-w-xs">
          <Icon name="search" size={ICON_SIZE.xs} className="shrink-0 text-doqyn-subtle" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar na matriz"
            className="text-label placeholder:text-doqyn-subtle"
            aria-label="Buscar na matriz"
          />
        </label>

        <CategoryFilter
          value={categoryId}
          onChange={setCategoryId}
          options={[
            { value: '', label: 'Todas as categorias' },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />

        {data && (
          <span className="ml-auto pb-2 font-mono text-micro tabular-nums text-doqyn-subtle">
            {documentCount} documento{documentCount === 1 ? '' : 's'} · {axisCount} {axisNoun}
            {axisCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading && (
          <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 text-caption text-doqyn-muted">
            <Icon name="progress_activity" size={ICON_SIZE.sm} className="animate-spin" />
            Montando a matriz
          </div>
        )}

        {!isLoading && error && (
          <div className="flex min-h-[12rem] flex-col items-center justify-center px-6 text-center">
            <p className="text-label font-medium text-doqyn-text">
              Não foi possível montar a matriz
            </p>
            <p className="mt-1.5 max-w-[42ch] text-caption text-doqyn-muted">
              {(error as Error).message}
            </p>
          </div>
        )}

        {!isLoading && !error && tab === 'people' && data && (
          <AccessMatrixTable
            matrix={data}
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

        {!isLoading && !error && tab === 'groups' && data && (
          <GroupAccessMatrixTable matrix={data} />
        )}
      </div>
    </PageShell>
  );
}

export default MatrixPage;
