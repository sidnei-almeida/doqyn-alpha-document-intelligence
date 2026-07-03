import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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

function ReviewFieldValue({ field }: { field: ReviewField }) {
  const display = safeDisplayValue(field.value);

  return (
    <dd
      className={cn(
        'detail-value mt-0.5 break-words text-sm text-doqyn-text',
        field.multiline && 'whitespace-pre-wrap',
      )}
    >
      {display}
    </dd>
  );
}

export function ReviewBeforeSubmitDialog({
  open,
  title,
  description,
  sections,
  attentionMessage,
  submitting = false,
  confirmLabel = 'Confirmar e enviar',
  cancelLabel = 'Cancelar',
  editLabel = 'Editar informações',
  onCancel,
  onEdit,
  onConfirm,
}: ReviewBeforeSubmitDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open) return;

    titleRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onCancel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === overlayRef.current && !submitting) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-before-submit-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-doqyn-border bg-doqyn-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-doqyn-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id="review-before-submit-title"
              ref={titleRef}
              tabIndex={-1}
              className="text-base font-semibold text-doqyn-text outline-none"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-doqyn-muted">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="shrink-0 rounded-md p-1 text-doqyn-muted hover:bg-doqyn-hover hover:text-doqyn-text disabled:opacity-50"
            aria-label="Fechar revisão"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-4 scrollbar-thin">
          {attentionMessage && (
            <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-200/90">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
              <p>{attentionMessage}</p>
            </div>
          )}

          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-lg border border-doqyn-border bg-doqyn-card/40 p-4"
            >
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-doqyn-muted">
                {section.title}
              </h3>
              <dl className="detail-grid grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-3">
                {section.fields.map((field) => (
                  <div
                    key={`${section.title}-${field.label}`}
                    className={cn('detail-item min-w-0', field.multiline && 'sm:col-span-2')}
                  >
                    <dt className="text-xs text-doqyn-muted">{field.label}</dt>
                    <ReviewFieldValue field={field} />
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-doqyn-border px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onEdit} disabled={submitting}>
            {editLabel}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Enviando…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
