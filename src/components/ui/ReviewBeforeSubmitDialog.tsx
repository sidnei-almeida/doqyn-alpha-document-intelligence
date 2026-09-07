import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { safeDisplayValue } from '@/lib/reviewDisplay';

export type ReviewField = {
  label: string;
  value: string;
  multiline?: boolean;
};

export type ReviewSection = {
  title: string;
  fields: ReviewField[];
};

export type ReviewBeforeSubmitDialogProps = {
  open: boolean;
  title: string;
  description: string;
  sections: ReviewSection[];
  attentionMessage?: string;
  submitting?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  editLabel?: string;
  onCancel: () => void;
  onEdit: () => void;
  onConfirm: () => void;
};

/**
 * Última leitura antes de um ato irreversível.
 *
 * É ficha de registro, não formulário: cada seção é um grupo de linhas separadas por fio,
 * com rótulo em mono e valor em corpo. A caixa saiu — o que separa é a linha —, e o aviso
 * de irreversibilidade é uma faixa de latão à esquerda, porque latão aqui atesta e não decora.
 */
export function ReviewBeforeSubmitDialog({
  open,
  title,
  description,
  sections,
  attentionMessage,
  submitting = false,
  confirmLabel = 'Confirmar e enviar',
  cancelLabel = 'Voltar',
  editLabel,
  onCancel,
  onEdit,
  onConfirm,
}: ReviewBeforeSubmitDialogProps) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onCancel();
      }}
      title={title}
      subtitle={description}
      size="lg"
      dismissOnOverlay={!submitting}
      footer={
        <>
          {editLabel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onEdit} disabled={submitting}>
              {editLabel}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button type="button" size="sm" onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Enviando…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {attentionMessage ? (
          <aside className="review-attention" role="note">
            <Icon name="gavel" size={ICON_SIZE.xs} aria-hidden />
            <p>{attentionMessage}</p>
          </aside>
        ) : null}

        {sections.map((section) => (
          <section key={section.title} className="review-section">
            <p className="register-label text-doqyn-subtle">{section.title}</p>
            <dl className="review-section__list">
              {section.fields.map((field) => (
                <div
                  key={`${section.title}-${field.label}`}
                  className={cn('review-section__row', field.multiline && 'sm:col-span-2')}
                >
                  <dt className="type-caption text-doqyn-muted">{field.label}</dt>
                  <dd
                    className={cn(
                      'type-body mt-0.5 break-words text-doqyn-text',
                      field.multiline && 'whitespace-pre-wrap',
                    )}
                  >
                    {safeDisplayValue(field.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
