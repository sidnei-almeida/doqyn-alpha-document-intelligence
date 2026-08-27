import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { cn, formatDateTime } from '@/lib/utils';
import { AccessRequestDetailsPanel } from '@/features/users/components/AccessRequestDetailsPanel';
import type { PendingApprovalItem } from '../api/pendingApprovalsApi';
import { PENDING_TYPE_LABELS, isDocumentApproval } from '../api/pendingApprovalsApi';

type PendingApprovalReviewDialogProps = {
  open: boolean;
  item: PendingApprovalItem | null;
  isAdmin: boolean;
  saving?: boolean;
  onClose: () => void;
  onApprove: (item: PendingApprovalItem) => void;
  onReject: (item: PendingApprovalItem) => void;
};

function OrganizationValue({ tenantName, tenantId }: { tenantName?: string; tenantId: string }) {
  const primary = tenantName?.trim() || tenantId;
  const showSecondary = Boolean(tenantName?.trim() && tenantName.trim() !== tenantId);

  return (
    <div className="min-w-0">
      <p className="break-words text-sm font-medium text-doqyn-text">{primary}</p>
      {showSecondary && (
        <TruncatedText as="p" className="mt-0.5 text-[11px] text-doqyn-muted">
          {tenantId}
        </TruncatedText>
      )}
    </div>
  );
}

export function PendingApprovalReviewDialog({
  open,
  item,
  isAdmin,
  saving,
  onClose,
  onApprove,
  onReject,
}: PendingApprovalReviewDialogProps) {
  if (!open || !item) return null;

  /**
   * A ficha segue o que se pede, não o tipo exato.
   *
   * Roteava por `type !== 'document_upload'`, e por isso um pedido de download abria o painel de
   * dados cadastrais de quem pediu — junto com o atalho para Usuários, como se a decisão fosse
   * sobre a pessoa. É a mesma armadilha de decidir por tipo em vez de por natureza.
   */
  const aboutDocument = isDocumentApproval(item);

  return (
    <Modal
      open
      onClose={onClose}
      title="Revisar solicitação"
      subtitle={PENDING_TYPE_LABELS[item.type]}
      size="lg"
      footer={
        isAdmin ? (
          <>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onReject(item)}
              disabled={saving}
            >
              Rejeitar
            </Button>
            <Button type="button" onClick={() => onApprove(item)} disabled={saving}>
              {item.type === 'document_upload' ? 'Aprovar documento' : 'Aprovar'}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-4 text-sm">
        <dl className="detail-grid grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-3">
          <div className="detail-item min-w-0">
            <dt className="text-xs text-doqyn-muted">Solicitante</dt>
            <dd className="detail-value mt-0.5 break-words font-medium text-doqyn-text">
              {item.name}
            </dd>
          </div>
          <div className="detail-item min-w-0">
            <dt className="text-xs text-doqyn-muted">E-mail</dt>
            <dd className="detail-value mt-0.5 break-all text-doqyn-text">{item.email}</dd>
          </div>
          <div className="detail-item min-w-0">
            <dt className="text-xs text-doqyn-muted">Organização</dt>
            <dd className="mt-0.5">
              <OrganizationValue tenantName={item.tenantName} tenantId={item.tenantId} />
            </dd>
          </div>
          <div className="detail-item min-w-0">
            <dt className="text-xs text-doqyn-muted">Data</dt>
            <dd className="detail-value mt-0.5 whitespace-nowrap text-doqyn-text">
              {formatDateTime(item.requestedAt)}
            </dd>
          </div>
        </dl>

        <div>
          <p className="text-xs text-doqyn-muted">Status</p>
          <Badge variant="warning" className="mt-1">
            Pendente
          </Badge>
        </div>

        {!aboutDocument && (
          <AccessRequestDetailsPanel
            member={item.member}
            requestedAccess={item.requestedAccess}
            whatsapp={item.member?.whatsapp}
            consent={item.member?.consent}
            terms={item.member?.terms}
            notificationPreferences={item.member?.notificationPreferences}
            className={cn('rounded-lg border border-doqyn-border bg-doqyn-card/50 p-4')}
          />
        )}

        {aboutDocument && item.type !== 'document_upload' && (
          <div
            className={cn('space-y-3 rounded-lg border border-doqyn-border bg-doqyn-card/50 p-4')}
          >
            <div>
              <p className="text-xs text-doqyn-muted">Documento</p>
              <p className="mt-0.5 break-all text-sm font-medium text-doqyn-text">
                {item.subject?.documentName ?? item.subject?.documentId ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">Categoria</p>
              <p className="mt-0.5 text-sm text-doqyn-text">{item.subject?.categoryName ?? '—'}</p>
            </div>
            {item.type === 'document_share' && (
              <>
                <div>
                  <p className="text-xs text-doqyn-muted">Compartilhar com</p>
                  <p className="mt-0.5 text-sm text-doqyn-text">
                    {item.subject?.memberName ?? item.subject?.memberId ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-doqyn-muted">O que será concedido</p>
                  <p className="mt-0.5 text-sm text-doqyn-text">
                    {item.grants?.canDownload ? 'Ver e baixar' : 'Somente ver'}
                  </p>
                </div>
              </>
            )}
            <p className="text-xs text-doqyn-muted">
              {item.type === 'document_share'
                ? 'Ao aprovar, o documento é compartilhado com essa pessoa em nome do solicitante.'
                : 'Ao aprovar, o solicitante fica liberado para baixar este documento por sete dias.'}
            </p>
          </div>
        )}

        {item.type === 'document_upload' && item.documentUpload && (
          <div
            className={cn('space-y-3 rounded-lg border border-doqyn-border bg-doqyn-card/50 p-4')}
          >
            <div>
              <p className="text-xs text-doqyn-muted">Arquivo</p>
              <p className="mt-0.5 break-all text-sm font-medium text-doqyn-text">
                {item.documentUpload.originalFileName}
              </p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">Categoria sugerida</p>
              <p className="mt-0.5 text-sm text-doqyn-text">
                {item.documentUpload.className ?? item.documentUpload.classId ?? '—'}
              </p>
            </div>
            <p className="text-xs text-doqyn-muted">
              Os metadados foram extraídos automaticamente pela IA. Ao aprovar, o documento será
              publicado na Biblioteca em nome do solicitante.
            </p>
          </div>
        )}

        {!aboutDocument && (
          <Link
            to="/users"
            className="inline-flex items-center gap-1 text-xs text-doqyn-primary hover:underline"
          >
            Gerenciar em Usuários
            <Icon name="open_in_new" size={12} />
          </Link>
        )}
      </div>
    </Modal>
  );
}
