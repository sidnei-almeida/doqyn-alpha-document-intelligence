import { ReviewWorkflowSettingsPanel } from '@/features/document-send/components/ReviewWorkflowSettingsPanel';
import { NAMING_POLICY_LABELS } from '@/features/document-send/utils/reviewWorkflowSettings';
import { useUploadQueueContext } from '@/features/upload/uploadQueueContext';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';

/** Preferências de upload, nomeação e revisão da IA — sincronizadas com a fila global. */
export function UploadWorkflowSettingsSection() {
  const { reviewSettings, updateReviewSettings } = useUploadQueueContext();

  return (
    <div id="upload" className="scroll-mt-6">
      <div className="mb-4 flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-doqyn-on-accent"
          style={{ background: 'var(--gradient-action)' }}
        >
          <Icon name="auto_awesome" size={ICON_SIZE.md} aria-hidden />
        </span>
        <div>
          <h2 className="section-title">Upload e análise da IA</h2>
          <p className="mt-1 text-xs text-doqyn-muted">
            Nomeação, confirmação automática e comportamento em lote após a análise RAG. Salvo neste
            navegador e aplicado à Biblioteca e ao fluxo legado.
          </p>
          <p className="mt-2 text-[11px] text-doqyn-subtle">
            Nomeação: {NAMING_POLICY_LABELS[reviewSettings.defaultNamingPolicy]} · Revisão automática:{' '}
            {reviewSettings.autoReviewEnabled ? `sim (${reviewSettings.autoAcceptDelaySeconds}s)` : 'não'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-doqyn-border bg-doqyn-surface">
        <ReviewWorkflowSettingsPanel
          settings={reviewSettings}
          onChange={updateReviewSettings}
          variant="inline"
        />
      </div>
    </div>
  );
}
