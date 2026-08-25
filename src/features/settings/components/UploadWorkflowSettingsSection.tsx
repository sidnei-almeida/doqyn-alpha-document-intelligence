import { ReviewWorkflowSettingsPanel } from '@/features/document-send/components/ReviewWorkflowSettingsPanel';
import { NAMING_POLICY_LABELS } from '@/features/document-send/utils/reviewWorkflowSettings';
import { useUploadPolicy } from '@/features/settings/hooks/useUploadPolicy';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';

/** Política de upload, nomeação e revisão da IA — da organização, não do navegador. */
export function UploadWorkflowSettingsSection() {
  const { policy: reviewSettings, canManage, savePolicy } = useUploadPolicy();

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
            Nomeação, confirmação automática e comportamento em lote após a análise RAG. Definida
            pela organização e aplicada à Biblioteca e ao fluxo de envio.
          </p>
          <p className="mt-2 text-[11px] text-doqyn-subtle">
            Nomeação: {NAMING_POLICY_LABELS[reviewSettings.defaultNamingPolicy]} · Revisão
            automática:{' '}
            {reviewSettings.autoReviewEnabled
              ? `sim (${reviewSettings.autoAcceptDelaySeconds}s)`
              : 'não'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-doqyn-border bg-doqyn-surface">
        <ReviewWorkflowSettingsPanel
          settings={reviewSettings}
          onChange={(next) => void savePolicy(next)}
          disabled={!canManage}
          variant="inline"
        />
      </div>
    </div>
  );
}
