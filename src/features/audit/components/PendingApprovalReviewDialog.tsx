import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { cn, formatDateTime } from '@/lib/utils';
import type { PendingApprovalItem } from '../api/pendingApprovalsApi';
import { PENDING_TYPE_LABELS } from '../api/pendingApprovalsApi';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('audit');

  if (!open || !item) return null;

  /**
   * Toda decisão desta fila é sobre documento: envio, download ou compartilhamento.
   *
   * Já foi sobre pessoa também, quando o pedido de acesso existia — e a ficha então trazia os
   * dados cadastrais de quem pedia, junto com um atalho para Usuários. Hoje quem entra na
   * empresa entra por convite, sem fila e sem aprovação.
   */

  return (
    <Modal
      open
      onClose={onClose}
      title={t('pendingApprovalReviewDialog.revisarSolicitacao')}
      subtitle={PENDING_TYPE_LABELS[item.type]}
      size="lg"
      footer={
        isAdmin ? (
          <>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              {t('pendingApprovalReviewDialog.cancelar')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onReject(item)}
              disabled={saving}
            >
              {t('pendingApprovalReviewDialog.rejeitar')}
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
            <dt className="text-xs text-doqyn-muted">
              {t('pendingApprovalReviewDialog.solicitante')}
            </dt>
            <dd className="detail-value mt-0.5 break-words font-medium text-doqyn-text">
              {item.name}
            </dd>
          </div>
          <div className="detail-item min-w-0">
            <dt className="text-xs text-doqyn-muted">{t('pendingApprovalReviewDialog.eMail')}</dt>
            <dd className="detail-value mt-0.5 break-all text-doqyn-text">{item.email}</dd>
          </div>
          <div className="detail-item min-w-0">
            <dt className="text-xs text-doqyn-muted">
              {t('pendingApprovalReviewDialog.organizacao')}
            </dt>
            <dd className="mt-0.5">
              <OrganizationValue tenantName={item.tenantName} tenantId={item.tenantId} />
            </dd>
          </div>
          <div className="detail-item min-w-0">
            <dt className="text-xs text-doqyn-muted">{t('pendingApprovalReviewDialog.data')}</dt>
            <dd className="detail-value mt-0.5 whitespace-nowrap text-doqyn-text">
              {formatDateTime(item.requestedAt)}
            </dd>
          </div>
        </dl>

        <div>
          <p className="text-xs text-doqyn-muted">{t('pendingApprovalReviewDialog.status')}</p>
          <Badge variant="warning" className="mt-1">
            {t('pendingApprovalReviewDialog.pendente')}
          </Badge>
        </div>

        {item.type !== 'document_upload' && (
          <div
            className={cn('space-y-3 rounded-lg border border-doqyn-border bg-doqyn-card/50 p-4')}
          >
            <div>
              <p className="text-xs text-doqyn-muted">
                {t('pendingApprovalReviewDialog.documento')}
              </p>
              <p className="mt-0.5 break-all text-sm font-medium text-doqyn-text">
                {item.subject?.documentName ?? item.subject?.documentId ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">
                {t('pendingApprovalReviewDialog.categoria')}
              </p>
              <p className="mt-0.5 text-sm text-doqyn-text">{item.subject?.categoryName ?? '—'}</p>
            </div>
            {item.type === 'document_share' && (
              <>
                <div>
                  <p className="text-xs text-doqyn-muted">
                    {t('pendingApprovalReviewDialog.compartilharCom')}
                  </p>
                  <p className="mt-0.5 text-sm text-doqyn-text">
                    {item.subject?.memberName ?? item.subject?.memberId ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-doqyn-muted">
                    {t('pendingApprovalReviewDialog.oQueSeraConcedido')}
                  </p>
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
              <p className="text-xs text-doqyn-muted">{t('pendingApprovalReviewDialog.arquivo')}</p>
              <p className="mt-0.5 break-all text-sm font-medium text-doqyn-text">
                {item.documentUpload.originalFileName}
              </p>
            </div>
            <div>
              <p className="text-xs text-doqyn-muted">
                {t('pendingApprovalReviewDialog.categoriaSugerida')}
              </p>
              <p className="mt-0.5 text-sm text-doqyn-text">
                {item.documentUpload.className ?? item.documentUpload.classId ?? '—'}
              </p>
            </div>
            <p className="text-xs text-doqyn-muted">
              {t('pendingApprovalReviewDialog.osMetadadosForamExtraidos')}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
