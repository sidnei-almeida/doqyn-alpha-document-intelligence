import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { TableRowActionsMenu, type TableRowAction } from '@/components/ui/TableRowActionsMenu';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { useAuth } from '@/auth/useAuth';
import { searchShareableUsers } from '@/features/sharing/api/shareApi';
import { useUploadQueueContext } from '@/features/upload';
import { useDocumentCategories } from '@/features/library/hooks/useCategoryFolders';
import { showApiErrorToast } from '@/shared/feedback/appFeedback';
import { formatDateTime } from '@/lib/utils';
import {
  cancelDocumentRequest,
  createDocumentRequest,
  listDocumentRequests,
  REQUEST_STATUS_LABEL_KEYS,
  type DocumentRequestDirection,
  type DocumentRequestItem,
} from './api/documentRequestsApi';
import { RequestDocumentModal } from './components/RequestDocumentModal';
import { useTranslation } from 'react-i18next';

/**
 * Onde o documento que cumpriu o pedido de fato aparece.
 *
 * Quem pediu chega nele pela concessão criada no cumprimento, e a listagem principal da Biblioteca
 * não carrega concessões — só "Compartilhados comigo" carrega. Apontar para `/library` abriria
 * uma lista sem o item.
 */
function fulfilledDocumentPath(documentId: string): string {
  return `/library/shared?documentId=${encodeURIComponent(documentId)}`;
}

const STATUS_VARIANT: Record<DocumentRequestItem['status'], 'pending' | 'success' | 'neutral'> = {
  pending: 'pending',
  fulfilled: 'success',
  cancelled: 'neutral',
  expired: 'neutral',
};

/**
 * Pedidos de documento, nas duas direções.
 *
 * Fica fora da Biblioteca como coleção porque a Biblioteca lista **documentos**, e um pedido não é
 * um — enquanto ninguém envia, não existe arquivo nenhum. Fica ao lado dela na navegação porque é
 * trabalho de qualquer pessoa, não do administrador: é essa a diferença para a fila de Auditoria.
 */
export function DocumentRequestsPage() {
  const { t } = useTranslation('requests');

  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [direction, setDirection] = useState<DocumentRequestDirection>('received');
  const [modalOpen, setModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Quem clicou em "Solicitar documento" pediu o gesto, não a lista.
   *
   * O parâmetro é consumido ao abrir: sem isso, fechar o formulário e recarregar o abriria de
   * novo, e a lista viraria refém do endereço.
   */
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  /**
   * Cumprir é o envio de sempre, com o pedido no contexto do item.
   *
   * Reusa a fila inteira — análise, revisão, nomeação, e a revisão de envio quando o tenant a
   * exige. O que muda é só o `documentRequestId` que viaja junto: é dele que o servidor tira a
   * categoria, e por isso quem envia não escolhe onde o documento cai.
   */
  const { startUploadFromFiles } = useUploadQueueContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fulfilling, setFulfilling] = useState<DocumentRequestItem | null>(null);

  /**
   * As pessoas vêm de `/api/share/users`, não da listagem de membros.
   *
   * `useCompanyMembers` só dispara para quem administra o tenant, e a rota devolve 403 para os
   * demais — pedir um documento é trabalho de qualquer pessoa, e com aquela fonte o seletor vinha
   * vazio justamente para quem mais precisa dele. Esta rota é aberta a qualquer autenticado, já
   * devolve `userId` do auth e já exclui quem está pedindo.
   */
  const peopleQuery = useQuery({
    queryKey: ['shareable-users', 'document-requests'],
    queryFn: () => searchShareableUsers(''),
    enabled: Boolean(tenant?.tenantId),
  });
  const categoriesQuery = useDocumentCategories();

  const requestsQuery = useQuery({
    queryKey: ['document-requests', tenant?.tenantId, direction],
    queryFn: () => listDocumentRequests({ direction }),
    enabled: Boolean(tenant?.tenantId),
  });

  const people = useMemo(
    () =>
      (peopleQuery.data ?? []).map((person) => ({
        userId: person.userId,
        name: person.name || person.email || person.userId,
        email: person.email ?? '',
      })),
    [peopleQuery.data],
  );

  const categories = useMemo(
    () =>
      (categoriesQuery.data ?? []).map((category) => ({ id: category.id, name: category.name })),
    [categoriesQuery.data],
  );

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['document-requests'] });
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const createMutation = useMutation({
    mutationFn: createDocumentRequest,
    onSuccess: async () => {
      toast.success(t('documentRequestsPage.created'));
      setModalOpen(false);
      // Quem acabou de pedir quer ver o que pediu, não o que lhe pediram.
      setDirection('sent');
      await invalidate();
    },
    onError: (error) => showApiErrorToast(error, t('documentRequestsPage.createFailed')),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelDocumentRequest,
    onSuccess: async () => {
      toast.success(t('documentRequestsPage.cancelled'));
      await invalidate();
    },
    onError: (error) => showApiErrorToast(error, t('documentRequestsPage.cancelFailed')),
  });

  const items = requestsQuery.data ?? [];
  const received = direction === 'received';

  const pickFileFor = (item: DocumentRequestItem) => {
    setFulfilling(item);
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="register-label text-doqyn-subtle">{t('common:nav.biblioteca')}</p>
          <h1 className="type-display text-doqyn-text">{t('documentRequestsPage.pedidos')}</h1>
          <p className="type-body text-doqyn-muted">
            {t('documentRequestsPage.documentosQueVocePediu')}
          </p>
        </div>
        <Button type="button" onClick={() => setModalOpen(true)}>
          {t('documentRequestsPage.pedirDocumento')}
        </Button>
      </header>

      <div className="flex gap-4 border-b border-doqyn-border">
        {(['received', 'sent'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={
              direction === value
                ? 'border-b-2 border-doqyn-primary pb-2 text-sm text-doqyn-text'
                : 'pb-2 text-sm text-doqyn-muted hover:text-doqyn-text'
            }
            onClick={() => setDirection(value)}
          >
            {t(
              value === 'received'
                ? 'documentRequestsPage.tabReceived'
                : 'documentRequestsPage.tabSent',
            )}
          </button>
        ))}
      </div>

      <DataTable
        data={items}
        keyExtractor={(item) => item._id}
        emptyMessage={t(
          received
            ? 'documentRequestsPage.emptyReceivedTitle'
            : 'documentRequestsPage.emptySentTitle',
        )}
        emptyDescription={t(
          received
            ? 'documentRequestsPage.emptyReceivedDescription'
            : 'documentRequestsPage.emptySentDescription',
        )}
        onRowClick={(item) => {
          // Atendido leva ao documento; o resto não tem para onde ir ainda.
          if (item.fulfilledDocumentId) navigate(fulfilledDocumentPath(item.fulfilledDocumentId));
        }}
        columns={[
          {
            key: 'title',
            header: t('documentRequestsPage.columns.title'),
            render: (item) => (
              <div className="min-w-0">
                <TruncatedText as="p" className="font-medium text-doqyn-text">
                  {item.title}
                </TruncatedText>
                {item.description && <p className="meta-text truncate">{item.description}</p>}
              </div>
            ),
          },
          {
            key: 'party',
            header: received
              ? t('documentRequestsPage.columns.requestedBy')
              : t('documentRequestsPage.columns.requestedFrom'),
            render: (item) => {
              const party = received ? item.requestedBy : item.requestedFrom;
              return (
                <div className="min-w-0 max-w-[220px]">
                  <TruncatedText as="p" className="text-doqyn-text">
                    {party.name}
                  </TruncatedText>
                  <TruncatedText as="p" className="meta-text">
                    {party.email}
                  </TruncatedText>
                  {/* Num pedido de fora, a empresa é o contexto que decide se ele é legítimo: um
                      nome sozinho não diz a quem se está entregando documento. */}
                  {item.crossTenant ? (
                    <TruncatedText as="p" className="meta-text text-doqyn-accent-active">
                      {item.crossTenant.requesterTenantName}
                    </TruncatedText>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: 'category',
            header: t('documentRequestsPage.columns.category'),
            render: (item) =>
              item.categoryName || item.categoryId ? (
                <span className="text-doqyn-muted">{item.categoryName ?? item.categoryId}</span>
              ) : (
                // Pedido para fora não tem categoria: o documento nasce e mora no acervo de quem
                // envia, e nenhuma categoria daqui o alcança.
                <span className="text-doqyn-subtle">{t('documentRequestsPage.foraDoAcervo')}</span>
              ),
          },
          {
            key: 'dueAt',
            header: t('documentRequestsPage.columns.dueAt'),
            className: 'w-[168px]',
            render: (item) => (
              <span className="whitespace-nowrap font-mono text-micro tabular-nums text-doqyn-subtle">
                {item.dueAt ? formatDateTime(item.dueAt) : '—'}
              </span>
            ),
          },
          {
            key: 'status',
            header: t('documentRequestsPage.columns.status'),
            className: 'w-[116px]',
            render: (item) => (
              <Badge variant={STATUS_VARIANT[item.status]} dot>
                {t(REQUEST_STATUS_LABEL_KEYS[item.status])}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: '',
            className: 'w-[56px]',
            render: (item) => {
              const documentId = item.fulfilledDocumentId;
              const actions: TableRowAction[] = [
                {
                  // Só quem recebeu o pedido cumpre, e só enquanto ele está aberto.
                  label: t('documentRequestsPage.actions.upload'),
                  onClick: () => pickFileFor(item),
                  hidden: !received || item.status !== 'pending',
                },
                {
                  label: t('documentRequestsPage.actions.open'),
                  onClick: () => navigate(fulfilledDocumentPath(documentId ?? '')),
                  hidden: !documentId,
                },
                {
                  // Cancelar é de quem pediu, e só enquanto ninguém enviou.
                  label: t('documentRequestsPage.actions.cancel'),
                  tone: 'danger',
                  onClick: () => cancelMutation.mutate(item._id),
                  hidden: received || item.status !== 'pending',
                },
              ];

              return <TableRowActionsMenu actions={actions} />;
            },
          },
        ]}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // O input é reaproveitado entre linhas; sem limpar o valor, escolher o mesmo arquivo
          // duas vezes seguidas não dispara `change` de novo.
          event.target.value = '';
          if (!fulfilling || files.length === 0) return;

          startUploadFromFiles(files, {
            documentRequestId: fulfilling._id,
            categoryId: fulfilling.categoryId,
            categoryName: fulfilling.categoryName,
          });
          setFulfilling(null);
        }}
      />

      <RequestDocumentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        people={people}
        categories={categories}
        saving={createMutation.isPending}
        onSubmit={async (input) => {
          await createMutation.mutateAsync(input);
        }}
      />
    </div>
  );
}

export default DocumentRequestsPage;
